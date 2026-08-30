# Post-Offer HQ — Design Brainstorm

## Approach 1: Masala Ops
**Very Brief Intro:** A warm, editorial operations desk inspired by Indian food culture: cream paper, burnt orange energy, hand-inked accents, and confident typography. The product should feel like a calm command center with enough spice to make daily recruiter work feel alive.

**Probability:** 0.03

## Approach 2: Tiffin Ledger
**Very Brief Intro:** A refined ledger-like system with oat paper, terracotta, muted sage, and dense but breathable information blocks. It leans into trust, legibility, and quiet competence for people managing many candidate details at once.

**Probability:** 0.07

## Approach 3: Monsoon Dispatch
**Very Brief Intro:** A moody but still light-weight dispatch board using pale sand, ink navy, and bright orange signals. Editorial cards and weather-map-like progress marks create a narrative of moving candidates safely toward joining day.

**Probability:** 0.015

# Selected Direction: Masala Ops

## Design Movement
Contemporary Indian editorial design with the clarity of a well-made operations dashboard, borrowing the warmth of Swiggy's cream-and-orange visual language without copying its marks or UI. The visual reference is a printed kitchen pass translated into a modern digital control room.

## Core Principles
1. **Warm operational clarity:** Every section should help a recruiter decide what to do next within seconds.
2. **Editorial contrast:** Use display typography, offset labels, and asymmetric composition to prevent the interface from becoming a generic admin grid.
3. **Signal over decoration:** Orange and red are reserved for momentum, risk, and action; cream and beige carry the working surface.
4. **Human context:** Candidate names, dates, evidence, and recommended actions stay visible and conversational rather than abstracted into cold metrics.

## Color Philosophy
The base is a toasted cream that feels like paper under warm light. Beige surfaces create hierarchy without stark white boxes. The signature color is a saturated delivery-orange used as a purposeful pulse for actions, joining momentum, and selected navigation. Deep cocoa ink anchors text so the page feels softer and more distinctive than black-on-white. A leafy green is used sparingly for healthy progress, while turmeric yellow and tomato red provide low-noise status cues.

## Layout Paradigm
A persistent left rail works like a kitchen pass: always present, compact, and easy to scan. The main content opens into an offset editorial canvas rather than a centered application shell. KPI cards use a staggered strip, with the primary list occupying the visual center and a narrow “today’s attention” rail acting as a side note. Detail pages stack long-form sections vertically, with a sticky context header and generous inter-section breathing room.

## Signature Elements
- A small fork-and-route mark built from two curved orange strokes, used in the header and favicon.
- “Service line” dividers: thin cocoa rules with tiny circular markers that echo journey stages.
- Warm paper texture and offset orange corner tabs on the most important operational cards.

## Interaction Philosophy
Interactions should feel like acknowledging a ticket: direct, immediate, and reassuring. Hovering a row reveals its next-action affordance. Completing a journey step gives a brief orange confirmation pulse. Buttons use concise verbs, show pending state clearly, and never pretend that simulated messaging was actually delivered.

## Animation
Use fast 160–220ms ease-out transitions for hover, focus, and button press. On initial load, stagger major dashboard regions by 45ms, moving upward only 6px while fading in. Progress segments fill from left to right on first render. Modals enter with a subtle scale from 0.97 and opacity shift, never from scale zero. Toasts slide in from the bottom-right with a small orange accent bar. Respect `prefers-reduced-motion` by removing non-essential entrance and pulse effects.

## Typography System
Use **DM Serif Display** for page titles and large numeric moments, paired with **Manrope** for navigation, labels, table content, and controls. Headlines are compact and sentence case, typically 36–46px on desktop. KPI values use DM Serif Display at 34–42px. Body copy uses Manrope at 13–15px with generous line-height. Small labels use uppercase Manrope with 0.12em tracking, but never more than one line.

## Brand Essence
**Positioning:** A calm, human-first command center for recruiters who want every offered candidate to feel expected, informed, and ready to join.

**Personality:** warm, decisive, observant.

## Brand Voice
Headlines should sound like a capable teammate with good taste: direct, specific, and lightly food-adjacent without becoming gimmicky. CTAs use short verbs. Microcopy explains the why behind a state instead of leaving the recruiter guessing.

Example lines:
- “Make the next touch count.”
- “Three candidates need a little more attention before lunch.”

## Wordmark & Logo
The product mark is a compact fork-and-route symbol: two rounded orange tines arc into a single forward path, suggesting both food culture and candidate momentum. The wordmark is set in DM Serif Display with a custom shortened crossbar on the “t” in “Offer,” paired with small uppercase “HQ” in Manrope. The icon stands alone at 28px in the app rail and 20px as the favicon source.

## Signature Brand Color
**Delivery Orange — `#F56A2A`**. It is ownable because it is bright but earthy rather than fluorescent: warm enough to sit on cream, vivid enough to signal movement, and closely tied to the emotional lift of getting someone from accepted offer to first day.

## Style Decisions
- Keep the working canvas warm and paper-like; do not default to pure white.
- Use the orange only for real action, progress, or emphasis, never as a full-page gradient.
- Favor offset editorial composition and layered surfaces over identical rounded cards.
- Do not use the official Swiggy logo, wordmark, or proprietary imagery; the result is only palette- and mood-inspired.

- Delivery Orange `#F56A2A` appears as a signal, action, progress, or selected-state accent rather than the dominant background of a major page region.
- The fork-and-route mark and service-line dividers are one reusable visual language across logo, section breaks, journey progress, chart annotations, and key operational cards.
- Primary layouts avoid repeated identical rounded cards; hierarchy comes from layered warm paper surfaces, offset tabs, cocoa rules, and editorial asymmetry.
