# CLAUDE.md - Lanting Digital Website

## Project Overview
This is the business website for Lanting Digital LLC, a web and mobile app development consultancy run by Caleb Lanting. The site should convert visitors into leads by showcasing expertise, building trust, and making it easy to get in touch.

## Business Context
- **Owner**: Caleb Lanting, Front-End Developer specializing in React, React Native, TypeScript
- **Target Clients**: Small to medium businesses needing custom web apps, mobile apps, or PWAs
- **Pricing**: $75/hour ad-hoc, or SaaS tiers ($149/$299/$499/month)
- **Location**: Riverside, CA (serves remote clients nationwide)
- **Differentiator**: Personal attention, polish-focused UI/UX, AI-assisted development for speed

## Tech Stack (Existing)
- Static HTML/CSS/JS (HTML5 UP "Dimension" template base)
- Firebase Hosting + Firestore (contact form already working)
- SASS for styling (assets/sass/)
- Font Awesome icons
- jQuery (legacy, can modernize if beneficial)

## Brand Guidelines
- **Tone**: Professional but warm, approachable, trustworthy
- **Colors**: Current dark theme (#1b1f22 bg, white text) works well - keep it
- **Typography**: Source Sans Pro (already in use)
- **Vibe**: Modern, clean, premium but not pretentious

## Pages/Sections Needed

### 1. Hero/Home (expand current header)
- Clear value proposition: "Custom Web & Mobile Apps for Growing Businesses"
- Brief tagline about quality + affordability
- Primary CTA: "Let's Talk" or "Get a Quote"

### 2. Services (expand #work)
Create detailed service cards for:
- **Custom Web Applications** - React, Next.js, TypeScript dashboards and tools
- **Mobile Apps** - React Native cross-platform apps
- **Progressive Web Apps** - App-like experiences without app store friction
- **Figma to Code** - Pixel-perfect implementation of designs
- **Ongoing Support** - Maintenance retainers and SaaS hosting

Include pricing transparency (ranges, not exact - "Starting at $X")

### 3. Portfolio (NEW SECTION)
Showcase projects with:
- Screenshots/mockups
- Brief description of problem solved
- Tech stack used
- Results/outcomes if available

**Projects to feature:**
1. **Lanting Platform** - Internal business management system (Next.js, TypeScript, Supabase). Quote-to-contract workflows, client management.
2. **Roller Coaster Enthusiast App** - React Native app with ride logging, weighted rankings, social features, mini-games (Coastle, trivia, trading cards).
3. **Client Work** - Any completed client projects (Pete's Holiday Lighting website if applicable, etc.)

### 4. Process (NEW SECTION)
Brief overview of how working together looks:
1. Discovery Call (free)
2. Proposal & Quote
3. Design/Development
4. Review & Revisions
5. Launch & Support

### 5. About (expand #about)
- Personal story (passion for building, attention to detail)
- Photo of Caleb (professional headshot)
- Values: quality, integrity, partnership mindset
- Brief mention of faith-driven stewardship approach (subtle, authentic)

### 6. Contact (expand #contact)
- Contact form (already working with Firestore)
- Email: [add email]
- Phone: [add if desired]
- Calendly link for booking discovery calls (if available)
- Social links (LinkedIn, GitHub, Instagram)

### 7. FAQ (optional but helpful)
Common questions:
- How long does a typical project take?
- Do you work with existing codebases?
- What if I need changes after launch?
- How does pricing work?

## Technical Requirements
- Mobile-responsive (test at 375px, 768px, 1024px, 1440px)
- Fast loading (optimize images, lazy load where appropriate)
- SEO basics (meta tags, semantic HTML, alt text)
- Accessible (proper heading hierarchy, form labels, contrast)
- Keep Firebase integration working

## File Structure
```
/
├── index.html          # Main page (modal-based navigation)
├── assets/
│   ├── css/
│   │   └── main.css    # Compiled CSS
│   ├── sass/           # Source SASS files
│   ├── js/
│   │   └── main.js     # Main JS + Firebase form handler
│   └── webfonts/
├── images/             # All images
├── firebase.json       # Firebase config
└── CLAUDE.md           # This file
```

## Development Notes
- The template uses modal-style article popups (see main.js _show/_hide functions)
- Can add new articles by creating <article id="newpage"> in #main div
- Navigation items in header nav ul
- Firebase is initialized in index.html, db available as window.db
- Form submission handled in main.js at bottom

## Priority Order
1. Portfolio section with project screenshots (most important for leads)
2. Expanded services with more detail
3. Process section
4. About section with photo
5. FAQ
6. Polish and optimization

## When Making Changes
- Test the contact form still works after any changes
- Keep the smooth modal transitions working
- Maintain dark theme consistency
- Add console.logs during development, remove before committing

## Commit Instructions
- Commit often to the github repository
- In the terminal, run the following:
git add .
git commit -m "relevant description"
git push origin main
- The description should be customized depending on what you accomplished. 

## Firebase Deploy Instructions
- Use the MCP server that is already accessable from this terminal. 
- The MCP server has been set up, and the account has been re-authed recently, so you should have no problems communicating with firebase.
- Run "firebase deploy" as often as you need so that I can check the live site in real time.