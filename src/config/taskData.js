/**
 * Task pools per career tier.
 *
 * dept: "random" means TaskManager assigns a random department at spawn time.
 * route: ordered array for multi-stop tasks (dept is not used for multi-stop).
 * stops: number of delivery stops required.
 */
export const TASKS = {
  intern: [
    { name: 'Coffee Order (Oat Milk, Extra Shot, No Foam, Lukewarm)', dept: 'random', stops: 1 },
    { name: 'Photocopy This (17 Copies, Stapled, Not Stapled, Actually Stapled)', dept: 'random', stops: 1 },
    { name: 'Mail Delivery (Marked Urgent Three Weeks Ago)', dept: 'random', stops: 1 },
    { name: 'Supply Run: Post-its (The Good Kind)', dept: 'random', stops: 1 },
    { name: 'Printer Paper Refill (Again)', dept: 'random', stops: 1 },
    { name: 'Lost Badge Replacement Form', dept: 'HR', stops: 1 },
  ],
  associate: [
    { name: 'TPS Report (Cover Sheet Missing)', dept: 'random', stops: 1 },
    { name: 'Q3 Revenue Spreadsheet (Formulas Broken)', dept: 'FINANCE', stops: 1 },
    { name: 'Competitive Analysis (Just Google It)', dept: 'MARKETING', stops: 1 },
    { name: 'Slide Deck for Meeting About Meetings', dept: 'random', stops: 1 },
    { name: 'Data Pull (Nobody Will Read This)', dept: 'ENGINEERING', stops: 1 },
    { name: 'Reply All Apology for Previous Reply All', dept: 'random', stops: 1 },
  ],
  manager: [
    { name: 'Cross-Functional Alignment Brief', route: ['ENGINEERING', 'MARKETING'], stops: 2 },
    { name: 'Vendor Proposal Review', route: ['FINANCE', 'CEO'], stops: 2 },
    { name: 'Team Escalation Report', route: ['HR', 'ENGINEERING'], stops: 2 },
    { name: 'Product Roadmap Update', route: ['ENGINEERING', 'MARKETING'], stops: 2 },
    { name: 'Budget Reallocation Request', route: ['FINANCE', 'CEO'], stops: 2 },
    { name: 'Quarterly Review Prep', route: ['HR', 'CEO'], stops: 2 },
    // Single-stop tasks still spawn at Manager tier too
    { name: 'Status Update (For the Status Update Meeting)', dept: 'random', stops: 1 },
  ],
  director: [
    { name: 'Partnership Agreement', route: ['CEO', 'FINANCE'], stops: 2 },
    { name: 'Org Restructure Plan', route: ['HR', 'CEO'], stops: 2 },
    { name: 'Strategic Initiative Brief', route: ['MARKETING', 'FINANCE', 'CEO'], stops: 3 },
    { name: 'Annual Budget Defense', route: ['FINANCE', 'CEO'], stops: 2 },
    { name: 'Board Pre-Read Materials', route: ['CEO', 'FINANCE'], stops: 2 },
    { name: 'Headcount Justification', dept: 'HR', stops: 1 },
  ],
  ceo: [
    { name: 'M&A Term Sheet', route: ['FINANCE', 'CEO', 'HR'], stops: 3 },
    { name: 'IPO Filing Draft', route: ['FINANCE', 'CEO', 'MARKETING'], stops: 3 },
    { name: 'Company-Wide Reorg', route: ['HR', 'ENGINEERING', 'MARKETING'], stops: 3 },
    { name: 'Board Deck (FINAL FINAL v3)', route: ['CEO', 'FINANCE', 'MARKETING'], stops: 3 },
    { name: 'Strategic Vision Document (Just Vibes)', route: ['MARKETING', 'ENGINEERING', 'CEO'], stops: 3 },
    // Even CEOs get urgent single-stops
    { name: 'Investor Call Prep (In 5 Minutes)', dept: 'CEO', stops: 1 },
  ],
};
