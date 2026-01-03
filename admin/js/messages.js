/**
 * Admin Messages Management
 * Handles messaging between admin and clients
 */

// State
let allConversations = [];
let currentConversationClientId = null;
let messagesUnsubscribe = null;

// DOM Elements
const conversationsList = document.getElementById('conversations-list');
const chatEmpty = document.getElementById('chat-empty');
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const adminMessageInput = document.getElementById('admin-message-input');

// =============================================
// LOAD CONVERSATIONS
// =============================================

async function loadConversations() {
    if (!conversationsList) return;

    conversationsList.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>Loading...</p></div>';

    try {
        // Get all clients who have messages
        const messagesSnapshot = await db.collection('messages')
            .orderBy('createdAt', 'desc')
            .get();

        // Group by clientId
        const conversationsMap = new Map();

        messagesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const clientId = data.clientId;

            if (!conversationsMap.has(clientId)) {
                conversationsMap.set(clientId, {
                    clientId,
                    clientName: data.clientName || 'Unknown',
                    clientEmail: data.clientEmail || '',
                    lastMessage: data.content,
                    lastMessageTime: data.createdAt?.toDate(),
                    unreadCount: 0
                });
            }

            // Count unread messages from client
            if (!data.fromAdmin && !data.read) {
                const conv = conversationsMap.get(clientId);
                conv.unreadCount++;
            }
        });

        allConversations = Array.from(conversationsMap.values());

        // Sort by last message time
        allConversations.sort((a, b) => {
            const timeA = a.lastMessageTime || new Date(0);
            const timeB = b.lastMessageTime || new Date(0);
            return timeB - timeA;
        });

        // Update badge
        const totalUnread = allConversations.reduce((sum, c) => sum + c.unreadCount, 0);
        updateUnreadBadge(totalUnread);

        if (allConversations.length === 0) {
            conversationsList.innerHTML = `
                <div class="empty-state-sm">
                    <i class="fas fa-comments"></i>
                    <p>No conversations yet</p>
                </div>
            `;
            return;
        }

        renderConversations();

    } catch (error) {
        console.error('Error loading conversations:', error);
        conversationsList.innerHTML = `
            <div class="empty-state-sm">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading conversations</p>
            </div>
        `;
    }
}

function renderConversations() {
    conversationsList.innerHTML = allConversations.map(conv => {
        const initials = (conv.clientName || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const timeStr = conv.lastMessageTime ? formatRelativeTime(conv.lastMessageTime) : '';
        const preview = truncate(conv.lastMessage || '', 40);

        return `
            <div class="conversation-item ${currentConversationClientId === conv.clientId ? 'active' : ''}"
                 data-client-id="${conv.clientId}">
                <div class="conversation-avatar">${initials}</div>
                <div class="conversation-info">
                    <div class="conversation-name">${escapeHtml(conv.clientName)}</div>
                    <div class="conversation-preview">${escapeHtml(preview)}</div>
                </div>
                <div class="conversation-meta">
                    <span class="conversation-time">${timeStr}</span>
                    ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add click listeners
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', () => {
            selectConversation(item.dataset.clientId);
        });
    });
}

// =============================================
// SELECT CONVERSATION
// =============================================

function selectConversation(clientId) {
    currentConversationClientId = clientId;

    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.clientId === clientId);
    });

    // Find conversation
    const conv = allConversations.find(c => c.clientId === clientId);

    if (!conv) {
        // If not in conversations list, we need to get client info
        loadClientAndOpenChat(clientId);
        return;
    }

    openChat(conv);
}

async function loadClientAndOpenChat(clientId) {
    try {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (!clientDoc.exists) {
            console.error('Client not found');
            return;
        }

        const client = { id: clientDoc.id, ...clientDoc.data() };

        const conv = {
            clientId: client.id,
            clientName: client.name || 'Unknown',
            clientEmail: client.email || ''
        };

        // Add to conversations if not exists
        if (!allConversations.find(c => c.clientId === clientId)) {
            allConversations.unshift(conv);
            renderConversations();
        }

        openChat(conv);

    } catch (error) {
        console.error('Error loading client:', error);
    }
}

function openChat(conv) {
    // Update header
    const initials = (conv.clientName || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('chat-recipient-avatar').textContent = initials;
    document.getElementById('chat-recipient-name').textContent = conv.clientName || 'Unknown';
    document.getElementById('chat-recipient-email').textContent = conv.clientEmail || '';

    // Show chat
    chatEmpty?.classList.add('hidden');
    chatContainer?.classList.remove('hidden');

    // Load messages
    loadChatMessages(conv.clientId);
}

// =============================================
// LOAD MESSAGES
// =============================================

function loadChatMessages(clientId) {
    chatMessages.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i></div>';

    // Unsubscribe from previous listener
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    // Real-time listener
    messagesUnsubscribe = db.collection('messages')
        .where('clientId', '==', clientId)
        .orderBy('createdAt', 'asc')
        .onSnapshot(snapshot => {
            if (snapshot.empty) {
                chatMessages.innerHTML = `
                    <div class="chat-no-messages">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                `;
                return;
            }

            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            chatMessages.innerHTML = messages.map(msg => {
                const isFromAdmin = msg.fromAdmin;
                const timeStr = msg.createdAt ? formatMessageTime(msg.createdAt.toDate()) : '';

                return `
                    <div class="chat-message ${isFromAdmin ? 'sent' : 'received'}">
                        <div class="message-bubble">${escapeHtml(msg.content)}</div>
                        <div class="message-time">${timeStr}</div>
                    </div>
                `;
            }).join('');

            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // Mark messages as read
            markMessagesAsRead(messages.filter(m => !m.fromAdmin && !m.read));
        }, error => {
            console.error('Error loading messages:', error);
            chatMessages.innerHTML = '<p class="text-muted text-center">Error loading messages</p>';
        });
}

async function markMessagesAsRead(unreadMessages) {
    for (const msg of unreadMessages) {
        try {
            await db.collection('messages').doc(msg.id).update({
                read: true,
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            // Ignore
        }
    }

    // Update conversation unread count
    if (currentConversationClientId) {
        const conv = allConversations.find(c => c.clientId === currentConversationClientId);
        if (conv) {
            conv.unreadCount = 0;
            renderConversations();
        }
    }

    // Update total unread badge
    const totalUnread = allConversations.reduce((sum, c) => sum + c.unreadCount, 0);
    updateUnreadBadge(totalUnread);
}

// =============================================
// SEND MESSAGE
// =============================================

async function sendAdminMessage() {
    if (!currentConversationClientId) return;

    const content = adminMessageInput.value.trim();
    if (!content) return;

    const conv = allConversations.find(c => c.clientId === currentConversationClientId);
    if (!conv) return;

    const sendBtn = document.getElementById('send-admin-message');
    sendBtn.disabled = true;

    try {
        await db.collection('messages').add({
            clientId: currentConversationClientId,
            clientEmail: conv.clientEmail,
            clientName: conv.clientName,
            content: content,
            fromAdmin: true,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        adminMessageInput.value = '';

        // Update conversation last message
        conv.lastMessage = content;
        conv.lastMessageTime = new Date();
        renderConversations();

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        sendBtn.disabled = false;
    }
}

function updateUnreadBadge(count) {
    const badge = document.getElementById('unread-messages-badge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// =============================================
// EVENT LISTENERS
// =============================================

document.getElementById('send-admin-message')?.addEventListener('click', sendAdminMessage);

adminMessageInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendAdminMessage();
    }
});

// =============================================
// UTILITIES
// =============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.slice(0, length) + '...' : str;
}

function formatRelativeTime(date) {
    if (!date) return '';

    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function formatMessageTime(date) {
    if (!date) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(date);
}

// Export for use elsewhere
window.loadConversations = loadConversations;
window.selectConversation = selectConversation;
