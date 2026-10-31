export type ManualRoleKey = 'owner' | 'manager' | 'accountant' | 'staff';

export interface ManualChapter {
  number: string;
  titleMl: string;
  menuLabel: string;
  summaryMl: string;
  stepsMl: string[];
  importantNoteMl?: string;
}

export interface ManualPageGroup {
  pageTitleMl: string;
  chapters: ManualChapter[];
}

export interface RoleUserManual {
  key: ManualRoleKey;
  pdfFilename: string;
  docCode: string;
  malayalamRoleName: string;
  englishRoleLabel: string;
  titleMl: string;
  subtitleMl: string;
  accentColor: string;
  overviewMl: string;
  accessibleModulesMl: string[];
  pages: ManualPageGroup[];
  bestPracticesMl: string[];
}

export const MALAYALAM_USER_MANUALS: Record<ManualRoleKey, RoleUserManual> = {
  owner: {
    key: 'owner',
    pdfFilename: 'IPPAS-Owner-User-Manual-EN.pdf',
    docCode: 'DOC-EN-OWNER-01',
    malayalamRoleName: 'Owner',
    englishRoleLabel: 'Owner',
    titleMl: 'Owner User Manual',
    subtitleMl:
      'Complete Executive Guide to Catering Bookings, Top Clients, Quotations, Billing, Flexible Staff Payroll, Confidential Profit & Loss, and Full Database Backup & Restore',
    accentColor: '#be123c',
    overviewMl:
      'The Owner account provides full executive command over IPPAS Pulse for Outdoor Catering & Event Management in Calicut. Manage upcoming and completed bookings, top-client analytics, menu recipes, quotations, invoices, warehouse stock, flexible staff salary structures, confidential event-by-event Profit & Loss statements, team credentials, activity history, and full database backup and disaster recovery with live cloud synchronization. IPPAS Pulse operates with four dedicated role workspaces: Owner, Manager, Accountant, and Staff.',
    accessibleModulesMl: [
      'Dashboard (Executive KPIs, Treasury Breakdown, Monthly Revenue & 15-Day Backup Alert)',
      'Events (Upcoming vs Previous Bookings, Quotations, Shortage CSV & WhatsApp PDF+Text)',
      'Invoices (Tax/Billing Invoices, Discounts, Part Payments & Auto Final Settlement)',
      'Profit & Loss (Confidential Owner-Only Event & Monthly Net Margin Analytics)',
      'Stock (Warehouse Inventory, Expiry Alerts, Bulk Stock Update, CSV Export & Vendor Bills)',
      'Staff (Per-Hour / Per-Event / Monthly Salaries, Quick Salary Advance & Salary Slip PDFs)',
      'More Menu -> Clients (with Top Clients Leaderboard), Menu & Recipes, Users, Settings & Manuals'
    ],
    pages: [
      {
        pageTitleMl: 'App Installation, Executive Dashboard & Client Leaderboard',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 1-Tap Smartphone App Install & Streamlined Navigation',
            menuLabel: 'Login / Install App / Top & Bottom Navigation',
            summaryMl:
              'Install IPPAS Pulse directly alongside your smartphone apps and navigate every executive module in a single tap without extra device permissions.',
            stepsMl: [
              'Open IPPAS Pulse, enter your Owner username and password on the Sign-In screen, and click "Sign In".',
              'Tap "Install App" once on Android or Desktop Chrome/Edge to add the IPPAS Pulse icon directly to both your App Drawer and Home Screen with zero extra permissions required (on iPhone/iPad Safari, tap Share -> "Add to Home Screen").',
              'Use the single-row top navigation bar on desktop (with secondary modules neatly grouped under "More") or the 5-tab bottom bar and "Menu" sheet on mobile devices.',
              'Click your profile button in the top-right corner anytime to change your password or sign out securely.'
            ],
            importantNoteMl:
              'Each of the four user roles (Owner, Manager, Accountant, and Staff) sees only the screens and financial figures authorized for their responsibilities.'
          },
          {
            number: '02',
            titleMl: 'Executive Dashboard, Treasury Holdings & Top Clients Leaderboard',
            menuLabel: 'Dashboard / More -> Clients',
            summaryMl:
              'Monitor total revenue, confidential net profit, bank vs cash collections, and your highest-value clients in real time.',
            stepsMl: [
              'Review your four executive KPI cards on the Dashboard: Total Revenue, Net Profit/Loss on Completed Events (Owner-only), Pending Receivables, and Upcoming Bookings.',
              'Inspect "Account-wise Invoice Collections" to see exact funds received into each Bank/UPI account versus Cash in Hand at the office counter.',
              'Open "More -> Clients" to view the "Top Clients Leaderboard" at the top of the directory, automatically ranking your "Highest Paying Clients" (by verified invoice collections) and "Most Events Conducted" (by non-cancelled bookings).',
              'Use the quick filter tabs ("All Clients", "Highest Paying", "Most Events") to sort the entire Client Directory and review each client’s events conducted, total paid, and pending balance.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Menu Recipes, Catering Bookings, Quotations & Invoices',
        chapters: [
          {
            number: '03',
            titleMl: 'Menu Engineering & Adding Non-Stock Recipe Ingredients',
            menuLabel: 'More -> Menu & Recipes',
            summaryMl:
              'Build per-plate or per-kilogram menu items and link complete raw-material recipes—even for ingredients not currently in warehouse stock.',
            stepsMl: [
              'Open "Menu & Recipes" and click "+ Add Dish" to create dishes priced either Per Guest (Plate) or Per Kilogram (Kg).',
              'Click "Edit Recipe" on any dish to specify raw-material quantities required per guest or per kg for automatic event stock estimation.',
              'If a required spice, garnish, dairy item, or raw material is not yet listed in your warehouse inventory, click "+ Create New Ingredient (Not in Stock)" directly inside the Recipe modal, enter its name, unit, and unit cost, and it is registered and linked immediately.'
            ]
          },
          {
            number: '04',
            titleMl: 'Upcoming vs Previous Bookings, Quotations & WhatsApp PDF + Text',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'Manage upcoming functions separately from completed past events, print clean standalone documents, and send PDFs with auto-attached WhatsApp captions.',
            stepsMl: [
              'Open "Events" to view "Upcoming Bookings" and "Previous / Completed Events" cleanly separated, with 1-click filter tabs ("Split View", "Upcoming Only", "Previous Only") and "+ New Booking".',
              'Inside any event, add menu dishes, logistics/transport extras, and optional Bank/Payment Term toggles to generate a branded "Catering Proposal" quotation.',
              'Click any "Print" button to print ONLY that specific quotation, invoice, or expense sheet in clean A4 format—never the surrounding web interface.',
              'Click "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp": on smartphones, the PDF file and formatted client message attach together automatically in one step; on desktop/laptop browsers, an additional "Copy Text" button is provided for WhatsApp Web.'
            ]
          },
          {
            number: '05',
            titleMl: 'Invoices, Discounts, Part Payments & Final Settlement',
            menuLabel: 'Invoices',
            summaryMl:
              'Convert approved quotes into invoices, record bank or cash part payments, and automatically issue Final Settlement invoices.',
            stepsMl: [
              'Click "Approve Quote & Convert to Invoice" on a confirmed event (or "+ Create Invoice" in the Invoices module) to generate a sequentially numbered invoice (INV-...).',
              'Apply client discounts with an explanation note whenever needed and record advance or part payments specifying exact Bank/UPI destination account or Cash in Hand.',
              'Once 100% of the invoice balance is collected, the document automatically upgrades to a "Final Settlement Invoice" and hides pending payment-term clauses.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Flexible Staff Payroll, Salary Advances & Confidential Profit & Loss',
        chapters: [
          {
            number: '06',
            titleMl: '3 Staff Salary Structures, Quick Salary Advance & Salary Slip PDFs',
            menuLabel: 'Staff -> Crew & Shifts / Payroll Report',
            summaryMl:
              'Configure Per-Hour, Per-Event, or Monthly Fixed pay upfront when adding staff, and keep Salary Advances strictly separated from Standard Salary Payouts.',
            stepsMl: [
              'Open "Staff" and click "+ Add Staff": choose the staff member’s exact salary structure upfront — (1) Per Hour Salary (₹/hr), (2) Per Event Salary (₹/event per attended shift), or (3) Monthly Fixed Salary (₹/month + Effective Start Date).',
              'Assign event shifts, send 1-tap English duty rosters on WhatsApp, and mark attendance ("Present" / "Absent") after each function so wages calculate accurately.',
              'Click the dedicated amber "Salary Advance" button on any staff card (or in the header) to record an advance payout quickly. Salary Advances are tracked and displayed separately from Standard Salary Payouts across KPI cards, staff ledgers, Excel/CSV exports, and A4 Salary Slips.',
              'Switch to the "Payroll Report & Salary Slips" tab, select any date range, and export A4 Payroll Summary PDFs or individual Staff Salary Slip PDFs (with Print and WhatsApp PDF+Text sharing).'
            ],
            importantNoteMl:
              'If a staff member forgets their login password, either click the "Reset Password" key icon on their row in Staff or Users, or let them use "Forgot Staff Password?" on the Sign-In screen.'
          },
          {
            number: '07',
            titleMl: 'Confidential Owner Profit & Loss (P&L) Analytics',
            menuLabel: 'Profit & Loss',
            summaryMl:
              'Audit true net profit across every event by comparing invoiced revenue against all four operational cost heads and staff wages.',
            stepsMl: [
              'Open "Profit & Loss" (visible exclusively to the Owner) to inspect total contract revenue, raw-material stock pricing, extras/rentals cost, staff wages + allowances + extra staff expenses, and miscellaneous event expenses.',
              'Filter by event status or month, drill into individual event margin percentages, and print standalone A4 P&L statements for executive review.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Full Database Backup, Disaster Restore, 15-Day Reminder & Audit Log',
        chapters: [
          {
            number: '08',
            titleMl: 'Full Database Backup (.json / Excel / CSV) & Full Restore After Reset',
            menuLabel: 'Settings (or Dashboard) -> Full Database Backup & Restore',
            summaryMl:
              'Download a complete restorable snapshot of all business records and upload it anytime to restore 100% of your data if the database is ever reset.',
            stepsMl: [
              'Open "Settings" (or scroll to the Backup card on the Owner Dashboard) and click "Download Full Restorable Backup (.json)" to save a complete snapshot of clients, menu items, recipes, stock, vendor bills, events, quotes, shifts, staff payroll/advances, invoices, payments, and team accounts.',
              'You can also export multi-sheet ".xlsx" Excel workbooks or module-wise ".csv" spreadsheets anytime for offline accounting.',
              'If the app or database is ever reset or moved, click "Upload Backup (.json) File" under "Restore Full Database from Backup File", review the instant record-count preview, and click "Confirm & Restore Full Database Now" to repopulate both the live app and online cloud database automatically.'
            ],
            importantNoteMl:
              'Automated 15-Day Backup Notification: Every 15 days after your last backup download, a persistent reminder appears in your Owner Notification Bell and Dashboard and remains active until you download a fresh backup.'
          },
          {
            number: '09',
            titleMl: 'Simplified Edit Activity Notifications & User Credential Control',
            menuLabel: 'Bell Icon (Top Bar) / More -> Users',
            summaryMl:
              'Review exact field edits (Previous Data -> New Data) quietly inside the Notification Bell without intrusive popups, and manage team logins.',
            stepsMl: [
              'Click the Notification Bell in the top navigation bar whenever an unread badge appears to inspect staff, manager, or accountant edits—showing exact "Previous Data -> Updated Data" diffs.',
              'Open "More -> Users" to create or update Manager, Accountant, and Staff login credentials or perform 1-click password resets.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Download the "Full Restorable Backup (.json)" promptly whenever the 15-day Owner Backup Reminder appears and store a copy in cloud drive or email.',
      'Check the "Top Clients Leaderboard" in the Clients module before quoting repeat corporate or wedding clients to reward loyal accounts.',
      'Always use the dedicated "Salary Advance" button for mid-month staff advances so standard monthly/event salary settlements remain crystal clear.',
      'Mark event status as "Completed" and verify all 4 event expense categories after each function for accurate Owner Profit & Loss reporting.'
    ]
  },

  manager: {
    key: 'manager',
    pdfFilename: 'IPPAS-Manager-User-Manual-EN.pdf',
    docCode: 'DOC-EN-MANAGER-01',
    malayalamRoleName: 'Manager',
    englishRoleLabel: 'Manager',
    titleMl: 'Manager User Manual',
    subtitleMl:
      'Complete Operations Guide to Client Onboarding, Menu Recipes, Upcoming & Previous Bookings, Warehouse Stock, Shortage CSVs, and Staff Roster Management',
    accentColor: '#1d4ed8',
    overviewMl:
      'The Manager workspace in IPPAS Pulse streamlines day-to-day catering operations in Calicut—from registering enquiries and reviewing Top Clients to building custom event quotations, creating new recipe ingredients on the fly, checking warehouse stock sufficiency, exporting vendor shortage CSVs, scheduling crew shifts with flexible salary plans, and logging event operational expenses.',
    accessibleModulesMl: [
      'Dashboard (Operations Overview, Upcoming Functions, Low-Stock & Expiry Alerts)',
      'Events (Upcoming vs Previous Bookings, Quotations, Shortage CSV & WhatsApp PDF+Text)',
      'Stock (Warehouse Inventory, Expiry Tracking, Bulk Stock Update, CSV Export & Vendor Purchases)',
      'Staff (Onboarding with 3 Salary Plans, Shift Assignment, Attendance & WhatsApp Duty Alerts)',
      'More Menu -> Clients (with Top Clients Leaderboard), Menu & Recipes & Manuals (PDF)'
    ],
    pages: [
      {
        pageTitleMl: 'App Setup, Operations Dashboard, Clients & Menu Recipes',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 1-Tap Smartphone App Install & Operations Dashboard',
            menuLabel: 'Login / Install App / Dashboard',
            summaryMl:
              'Access live event schedules, guest counts, and warehouse alerts from your phone or desktop.',
            stepsMl: [
              'Sign in using your Manager username and password provided by the Owner.',
              'Tap "Install App" once to add IPPAS Pulse to your phone’s App Drawer and Home Screen without needing any special device permissions (on iPhone Safari, tap Share -> "Add to Home Screen").',
              'Use the Operations Dashboard to review confirmed upcoming bookings, total guest pax, low-stock ingredients, and items approaching expiry.'
            ]
          },
          {
            number: '02',
            titleMl: 'Client Directory, Top Clients Leaderboard & Menu Recipe Builder',
            menuLabel: 'More -> Clients / Menu & Recipes',
            summaryMl:
              'Identify top-performing clients instantly and maintain accurate dish recipes—including non-stock ingredients.',
            stepsMl: [
              'Open "Clients" to add new customer profiles and view the "Top Clients Leaderboard" highlighting your "Highest Paying Clients" and "Most Events Conducted".',
              'Open "Menu & Recipes" to add catering dishes (priced Per Guest or Per Kg) and click "Edit Recipe" to define ingredient quantities per guest/kg.',
              'When building a recipe, if an ingredient is not yet in warehouse stock, click "+ Create New Ingredient (Not in Stock)" right inside the recipe window to register and link it without leaving the screen.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Catering Bookings, Quotations, Stock Sufficiency & Warehouse Control',
        chapters: [
          {
            number: '03',
            titleMl: 'Upcoming vs Previous Bookings, Standalone Print & WhatsApp Sharing',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'Create catering proposals, separate upcoming functions from past events, and share clean PDFs with auto-attached client messages.',
            stepsMl: [
              'Open "Events" to view "Upcoming Bookings" clearly separated from "Previous / Completed Events", or click "+ New Booking" to register a new function.',
              'Inside the event workspace, add menu items, rental/transport extras, and toggle Bank Details or Payment Terms on the quotation.',
              'Click "Print Proposal" to print ONLY the A4 quotation document (excluding web navigation).',
              'Click "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" to share both the PDF proposal and greeting text together on mobile (with a "Copy Text" helper shown on desktop web view).'
            ]
          },
          {
            number: '04',
            titleMl: 'Warehouse Inventory, Expiry Alerts, Vendor Purchases & Shortage CSV Export',
            menuLabel: 'Stock / Event Sufficiency',
            summaryMl:
              'Keep kitchen raw materials up to date and export instant CSV purchase lists for vendors.',
            stepsMl: [
              'Open "Stock" to add raw materials, track batch expiry dates, record "Vendor Stock Purchases" (with bill numbers), or run a fast "Bulk Stock Update" after physical kitchen counts.',
              'Click "Export Inventory & Shortage CSV" on the Stock page (or inside an Event’s Stock Sufficiency panel) to download a clean spreadsheet of current stock levels and exact shortage quantities needed for vendor ordering.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Staff Salary Plans, Shift Roster, Attendance & Event Expenses',
        chapters: [
          {
            number: '05',
            titleMl: 'Onboarding Staff (3 Salary Plans), Shift Rosters & Password Resets',
            menuLabel: 'Staff / Event -> Crew Shifts',
            summaryMl:
              'Choose the right pay structure when adding staff, dispatch WhatsApp shift alerts, mark attendance, and log on-site event expenses.',
            stepsMl: [
              'When adding a crew member in "Staff -> + Add Staff", select their salary structure upfront: Per Hour Salary (₹/hr), Per Event Salary (₹/event), or Monthly Fixed Salary (₹/month).',
              'Assign crew members to event shifts with reporting/closing times and duty notes, then click the WhatsApp button to send their formatted English duty notification.',
              'After the function, mark each assigned crew member "Present" or "Absent" so payroll earnings update automatically, and log actual Stock Pricing, Extras Taken, Staff Extra Expenses, and Other Expenses under the event’s Expenses tab.',
              'If a staff member forgets their login password, click the key icon ("Reset Password") next to their profile to issue a fresh password immediately.'
            ],
            importantNoteMl:
              'Only shifts marked "Present" count toward Per-Hour and Per-Event wage calculations—always verify attendance right after every event.'
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Check the Event Stock Sufficiency table 48 hours before every confirmed event and export the Shortage CSV for timely vendor procurement.',
      'Use "+ Create New Ingredient" inside Menu Recipes whenever chefs introduce specialty spices or garnishes so event raw-material estimates stay 100% complete.',
      'Mark crew shift attendance ("Present" / "Absent") immediately after each catering function concludes.'
    ]
  },

  accountant: {
    key: 'accountant',
    pdfFilename: 'IPPAS-Accountant-User-Manual-EN.pdf',
    docCode: 'DOC-EN-ACCOUNTANT-01',
    malayalamRoleName: 'Accountant',
    englishRoleLabel: 'Accountant',
    titleMl: 'Accountant User Manual',
    subtitleMl:
      'Complete Accounting Guide to Client Billing, Bank vs Cash Treasury, Separated Salary Advances, Date-Range Payroll Slips, and Vendor Settlements',
    accentColor: '#047857',
    overviewMl:
      'The Accountant workspace in IPPAS Pulse centralizes all receivables, payables, and payroll operations—covering client invoicing, discounts, bank vs cash collection tracking, Top Clients revenue rankings, vendor credit settlements, event expense vouchers, flexible staff salary structures, separated Salary Advances, and printable A4 Salary Slips.',
    accessibleModulesMl: [
      'Dashboard (Financial Overview, Receivables, Payables & Bank vs Cash Treasury)',
      'Invoices (Billing Invoices, Discounts, Part Payments, Final Settlement & WhatsApp PDF+Text)',
      'Events (Contract Totals, Billing Status & 4-Head Event Extra Expense Ledger)',
      'Staff (Per-Hour / Per-Event / Monthly Payroll, Quick Salary Advance & A4 Salary Slip PDFs)',
      'Stock (Vendor Purchase Bills, Credit Balances & Supplier Payment Settlements)',
      'More Menu -> Clients (with Top Clients Leaderboard) & Manuals (PDF)'
    ],
    pages: [
      {
        pageTitleMl: 'Financial Dashboard, Treasury Reconciliation & Client Billing',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 1-Tap App Install, Treasury Holdings & Top Clients',
            menuLabel: 'Dashboard / More -> Clients',
            summaryMl:
              'Track total invoiced revenue, pending client dues, bank vs cash balances, and highest-paying clients.',
            stepsMl: [
              'Sign in with your Accountant credentials and tap "Install App" once to add IPPAS Pulse to your desktop or smartphone without extra permissions.',
              'Review "Account-wise Invoice Collections" on the Dashboard to reconcile exact amounts received in each Bank/UPI account versus Cash in Hand.',
              'Open "More -> Clients" to inspect the "Top Clients Leaderboard" ("Highest Paying Clients" and "Most Events Conducted") and monitor client-wise pending receivables.'
            ]
          },
          {
            number: '02',
            titleMl: 'Invoices, Discounts, Part Payments, Standalone Print & WhatsApp PDF+Text',
            menuLabel: 'Invoices',
            summaryMl:
              'Issue accurate client invoices, log every advance/installment, and share standalone PDFs with auto-attached text.',
            stepsMl: [
              'Convert approved event proposals into sequentially numbered invoices (INV-...) or create deposit/final invoices directly from the "Invoices" page.',
              'Apply authorized discounts with clear notes and click "Record Payment" for every client receipt—selecting whether funds arrived via Bank/UPI (choosing the exact bank account) or Cash in Hand.',
              'When an invoice is paid in full, IPPAS Pulse automatically converts it into a "Final Settlement Invoice" and removes pending payment-term clauses.',
              'Use "Print" to print ONLY the A4 invoice (never the web page chrome), or click "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" to attach both the invoice PDF and message text automatically.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Staff Payroll, Quick Salary Advance Separation & Salary Slip PDFs',
        chapters: [
          {
            number: '03',
            titleMl: 'Quick "Salary Advance" Button vs Standard Salary Payouts',
            menuLabel: 'Staff -> Crew & Shifts',
            summaryMl:
              'Record mid-period staff advances in one click while keeping them strictly separated from regular monthly or event salary payouts.',
            stepsMl: [
              'Open "Staff" to view each crew member’s configured pay plan: Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month).',
              'When issuing a mid-month or pre-event advance, click the amber "Salary Advance" button on the staff card (or top toolbar), enter the advance amount, payment method (Cash / UPI / Bank), and note, and save.',
              'When settling regular wages, click "Pay Salary" to record a Standard Salary Payout, or click "+ Allowance" to add travel/overtime bonuses.',
              'Both Standard Salary Payouts and Salary Advances deduct accurately from Net Balance Payable while remaining clearly separated in KPI cards, transaction ledgers, and salary statements.'
            ],
            importantNoteMl:
              'Never mix advance disbursements into generic notes on regular payouts—always use the dedicated "Salary Advance" button for clean audit trails.'
          },
          {
            number: '04',
            titleMl: 'Date-Range Payroll Reports & Printable A4 Staff Salary Slips',
            menuLabel: 'Staff -> Payroll Report & Salary Slips',
            summaryMl:
              'Generate custom date-range payroll summaries and export or WhatsApp official A4 Salary Slip PDFs.',
            stepsMl: [
              'Open the "Payroll Report & Salary Slips" tab on the Staff page and select your target Start Date and End Date (or tap "This Month" / "Last Month").',
              'Review period hours worked, shifts attended, base/shift earnings, allowances, Standard Salary Paid, Salary Advances Taken, and closing payable balance for every staff member.',
              'Click "Slip PDF" or "Print" on any row to download or print a standalone A4 Staff Salary Slip, or click "WhatsApp" to send the PDF slip + text summary directly to the staff member.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Vendor Purchase Bills & Event Extra Expense Accounting',
        chapters: [
          {
            number: '05',
            titleMl: 'Supplier Credit Settlements & 4-Category Event Extra Expenses',
            menuLabel: 'Stock -> Vendor Purchases / Events -> Expenses',
            summaryMl:
              'Settle pending supplier bills and record complete event-level expenditure vouchers.',
            stepsMl: [
              'Open "Stock -> Vendor Purchases" to review all raw-material purchase bills, partial payments, and outstanding supplier credit balances, and click "Record Payment" whenever vendor dues are cleared.',
              'Open any booking under "Events -> Expenses" to log or verify the 4 operational cost heads: (1) Stock Pricing, (2) Extras Taken Cost, (3) Staff Extra Expenses, and (4) Other Expenses, and print standalone A4 Event Expense Sheets when required.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Always verify the exact destination Bank Account vs Cash in Hand before saving any client invoice payment.',
      'Use the "Payroll Report & Salary Slips" date-range view at month-end to export batch A4 Salary Slips for your accounting records.',
      'Reconcile pending supplier bills in "Stock -> Vendor Purchases" weekly to keep payables accurate.'
    ]
  },

  staff: {
    key: 'staff',
    pdfFilename: 'IPPAS-Staff-User-Manual-EN.pdf',
    docCode: 'DOC-EN-STAFF-01',
    malayalamRoleName: 'Staff',
    englishRoleLabel: 'Staff',
    titleMl: 'Staff User Manual',
    subtitleMl:
      'Simple Crew Guide to Mobile Sign-In, Self-Service Password Reset, 1-Tap App Install, Upcoming vs Attended Events, and Salary & Advance Tracking',
    accentColor: '#6d28d9',
    overviewMl:
      'The IPPAS Pulse Staff Portal gives every catering crew member, chef, captain, and server a clean, mobile-friendly view of their upcoming catering duties, Google Maps venue locations, completed event history, configured salary rate (Per Hour, Per Event, or Monthly Fixed), Standard Salary Received, Salary Advances taken, and exact Pending Balance Payable.',
    accessibleModulesMl: [
      'My Portal (Upcoming Events, Attended Events History & Salary / Advance Summary)',
      'Manuals (Downloadable Official Staff User Manual A4 PDF)',
      'Profile / Menu -> Change Password & Secure Logout'
    ],
    pages: [
      {
        pageTitleMl: 'Mobile Sign-In, Password Recovery & 1-Tap Smartphone App Install',
        chapters: [
          {
            number: '01',
            titleMl: 'Signing In with Your Mobile Number & Self-Service Password Reset',
            menuLabel: 'Sign In / Forgot Staff Password?',
            summaryMl:
              'Log in effortlessly using your registered 10-digit mobile number and reset your password anytime if forgotten.',
            stepsMl: [
              'Open IPPAS Pulse on your smartphone and enter your registered 10-digit mobile number in the "Username or Phone Number" field.',
              'Enter your password and tap "Sign In" to open your personal Staff Duty & Salary Portal.',
              'If you ever forget your password, tap "Forgot Staff Password?" right on the Sign-In screen, verify your registered mobile number and full name, and set a new password immediately (or ask your Manager/Owner for a 1-click reset).'
            ],
            importantNoteMl:
              'Keep Mobile Data or Wi-Fi turned on when opening the app so your latest shift assignments and salary updates sync automatically.'
          },
          {
            number: '02',
            titleMl: '1-Tap Smartphone App Installation (Zero Extra Permissions)',
            menuLabel: 'Install App Banner / Button',
            summaryMl:
              'Add the IPPAS Pulse icon alongside your other phone apps and on your Home Screen in one tap.',
            stepsMl: [
              'Tap the "Install App" button shown on the Sign-In screen or at the top of your Staff Portal.',
              'On Android phones, confirm "Install" once—IPPAS Pulse will appear in your phone’s App Drawer alongside all other apps and create a Home Screen shortcut automatically without asking for contacts, storage, or camera permissions.',
              'On iPhone (Safari), tap the bottom "Share" icon and choose "Add to Home Screen".'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Upcoming Duties, Attended Events, Salary Plan & Advances',
        chapters: [
          {
            number: '03',
            titleMl: 'Checking Upcoming Events & Attended Events Separately',
            menuLabel: 'My Portal -> Upcoming Events / Attended Events',
            summaryMl:
              'View your next scheduled catering function, reporting time, and venue map separately from completed duties.',
            stepsMl: [
              'Under "Upcoming Events", check your "Next Scheduled Duty" card for the exact event date, reporting and closing times, assigned role, guest count, duty instructions, and the 1-tap "Open Venue in Google Maps" button.',
              'Scroll to "Events Attended So Far" (or tap the filter tab at the top) to see every completed catering event you have worked, hours logged, attendance status ("Attended" vs "Attendance Pending"), and shift earnings.',
              'Use the segmented filter bar ("All Overview", "Upcoming Events", "Attended Events", "Salary Received") to focus on any single section instantly.'
            ]
          },
          {
            number: '04',
            titleMl: 'Understanding Your Salary Plan, Standard Payouts & Salary Advances',
            menuLabel: 'My Portal -> Salary KPIs & Payouts Table',
            summaryMl:
              'Track your total earnings, regular salary payouts, salary advances, and remaining balance transparently.',
            stepsMl: [
              'Your configured pay plan—Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month)—is displayed clearly at the top of your portal.',
              'The 4 summary cards show: (1) Total Salary Earned (including any extra duty allowances/bonuses), (2) Standard Salary Paid, (3) Salary Advances Taken (tracked separately), and (4) Pending Balance Payable.',
              'Open "Salary Payouts & Advances Received" to see every payment date, whether it was a "Standard Salary" payout or a "Salary Advance", payment method (Cash / UPI / Bank), and exact amount.'
            ]
          },
          {
            number: '05',
            titleMl: 'Changing Your Password, Downloading This PDF & Signing Out',
            menuLabel: 'Change Password / Manuals / Logout',
            summaryMl:
              'Keep your personal salary portal private and save this guide offline on your phone.',
            stepsMl: [
              'Tap "Change Password" in your portal header (or bottom Menu) after your first login to set a private password known only to you.',
              'Tap "Staff User Manual (PDF)" anytime to download this A4 English guide onto your smartphone for offline reference.',
              'Always tap "Logout" if you sign in from a shared phone or office computer.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Open IPPAS Pulse the evening before every scheduled function to double-check your reporting time, uniform/duty note, and Google Maps venue pin.',
      'After completing an event shift, verify that your attendance is marked "Attended" so your earnings reflect immediately.',
      'Keep your password private so your salary and advance records remain confidential.'
    ]
  }
};

export const MANUAL_ROLE_ORDER: ManualRoleKey[] = ['owner', 'manager', 'accountant', 'staff'];
