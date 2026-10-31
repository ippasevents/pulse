export type ManualRoleKey = 'owner' | 'manager' | 'accountant' | 'staff';
export type ManualLanguage = 'en' | 'ml';

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

/**
 * OFFICIAL ENGLISH EDITION USER MANUALS (4 Roles: Owner, Manager, Accountant, Staff)
 */
export const ENGLISH_USER_MANUALS: Record<ManualRoleKey, RoleUserManual> = {
  owner: {
    key: 'owner',
    pdfFilename: 'IPPAS-Owner-User-Manual-EN.pdf',
    docCode: 'DOC-EN-OWNER-02',
    malayalamRoleName: 'Owner',
    englishRoleLabel: 'Owner',
    titleMl: 'Owner User Manual (English Edition)',
    subtitleMl:
      'Complete Executive Guide to Catering Bookings, Mandatory Quotation Labour Charges, Historical Price Locks, Flexible Staff Payroll, Confidential Profit & Loss, and Full Database Backup & Restore',
    accentColor: '#be123c',
    overviewMl:
      'The Owner account provides full executive command over IPPAS Pulse for Outdoor Catering & Event Management in Calicut. Manage upcoming and completed bookings, top-client analytics, menu recipes, quotations with automatic crew Labour Charges, locked historical invoices, warehouse stock, flexible staff salary structures, confidential event-by-event Profit & Loss statements, team credentials, activity history, and full database backup and disaster recovery with live cloud synchronization. IPPAS Pulse operates with four dedicated role workspaces: Owner, Manager, Accountant, and Staff.',
    accessibleModulesMl: [
      'Dashboard (Executive KPIs, Treasury Breakdown, Monthly Revenue & 15-Day Backup Alert)',
      'Events (Upcoming vs Previous Bookings, Mandatory Quotation Labour Charges, Shortage CSV & WhatsApp PDF+Text)',
      'Invoices (Locked Historical Billing Snapshots, Discounts, Part Payments & Auto Final Settlement)',
      'Profit & Loss (Confidential Owner-Only Event & Monthly Net Margin Analytics)',
      'Stock (Warehouse Inventory, Forward-Only Stock Price Updates, Expiry Alerts, CSV Export & Vendor Bills)',
      'Staff (Per-Hour / Per-Event / Monthly Salaries, Shift Rate Lock or Switch, Quick Salary Advance & Salary Slip PDFs)',
      'More Menu -> Clients (Top Clients Leaderboard), Menu & Recipes, Users, Settings & Bilingual Manuals (EN / ML)'
    ],
    pages: [
      {
        pageTitleMl: 'App Installation, Executive Dashboard & Client Leaderboard',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 2-of-3 Forgot Password Reset & 1-Tap App Install',
            menuLabel: 'Login / Forgot Password? / Install App',
            summaryMl:
              'Sign in securely, recover forgotten passwords using 2-of-3 verification, and install IPPAS Pulse on your smartphone in one tap.',
            stepsMl: [
              'Open IPPAS Pulse, enter your Owner username (or Unique ID / registered phone) and password on the Sign-In screen, and click "Sign In".',
              'If any user (Owner, Manager, Accountant, or Staff) forgets their password, click "Forgot Password?" on the Sign-In screen, select ANY TWO (2) of the three verification options — (1) Unique ID, (2) Phone Number, or (3) Date of Birth — enter the matching details, and set a new password immediately.',
              'Tap "Install App" once on Android or Desktop Chrome/Edge to add the IPPAS Pulse icon directly to both your App Drawer and Home Screen with zero extra permissions required (on iPhone/iPad Safari, tap Share -> "Add to Home Screen").',
              'Use the single-row top navigation bar on desktop (with secondary modules neatly grouped under "More") or the 5-tab bottom bar and "Menu" sheet on mobile devices.'
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
        pageTitleMl: 'Menu Rate Protection, Mandatory Quotation Labour Charges & Invoices',
        chapters: [
          {
            number: '03',
            titleMl: 'Menu Engineering, Non-Stock Ingredients & Historical Dish Rate Protection',
            menuLabel: 'More -> Menu & Recipes',
            summaryMl:
              'Build per-plate or per-kilogram menu items, add non-stock recipe ingredients on the fly, and update dish rates safely without altering past events.',
            stepsMl: [
              'Open "Menu & Recipes" and click "+ Add Dish" to create dishes priced either Per Guest (Plate) or Per Kilogram (Kg).',
              'Click "Edit Recipe" on any dish to specify raw-material quantities required per guest or per kg. If an ingredient is not yet in warehouse stock, click "+ Create New Ingredient (Not in Stock)" directly inside the Recipe modal to register and link it immediately.',
              'Whenever you edit a dish’s selling rate (for example, updating ₹100 today to ₹120 tomorrow), the updated rate applies ONLY to newly created quotations and newly added event dishes going forward—all earlier events, quotations, and invoices retain their original locked dish rate and dish name unchanged.'
            ]
          },
          {
            number: '04',
            titleMl: 'Bookings, Mandatory Quotation "Labour Charges" & WhatsApp PDF + Text',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'Automatically include assigned crew salary totals as a mandatory "Labour Charges" line item in every quotation, print standalone A4 sheets, and share on WhatsApp.',
            stepsMl: [
              'Open "Events" to view "Upcoming Bookings" and "Previous / Completed Events" cleanly separated, with 1-click filter tabs ("Split View", "Upcoming Only", "Previous Only") and "+ New Booking".',
              'Assign crew members under the event’s "Staff Shifts" section: IPPAS Pulse automatically calculates the total assigned salary of all non-absent crew members for that event and includes a mandatory "Labour Charges" line item inside the event’s Quotation (Proposal PDF, A4 Print, and WhatsApp message).',
              'Use "Manage Crew" or "Sync Labour Charges" in the Quotation Builder anytime crew shifts change on an active event, and click any "Print" button to print ONLY that specific A4 document—never the surrounding web page.',
              'Click "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" to attach both the PDF document and formatted client message automatically on smartphones (with a "Copy Text" helper on desktop web view).'
            ]
          },
          {
            number: '05',
            titleMl: 'Invoices, Locked Historical Billing, Discounts & Final Settlement',
            menuLabel: 'Invoices',
            summaryMl:
              'Convert approved quotes into immutable invoices, record bank or cash part payments, and automatically issue Final Settlement invoices.',
            stepsMl: [
              'Click "Approve Quote & Convert to Invoice" on a confirmed event (or "+ Create Invoice" in the Invoices module) to generate a sequentially numbered invoice (INV-...) with a locked line-item snapshot.',
              'Apply client discounts with an explanation note whenever needed and record advance or part payments specifying exact Bank/UPI destination account or Cash in Hand.',
              'Once 100% of the invoice balance is collected, the document automatically upgrades to a "Final Settlement Invoice"—and finalized invoices never change even if stock, menu, or staff rates change later.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Staff Salary Rate Locks, Stock Price Protection & Confidential P&L',
        chapters: [
          {
            number: '06',
            titleMl: 'Staff Unique ID & DOB, 3 Salary Plans, Shift Rate Policy & Advances',
            menuLabel: 'Staff -> + Add Staff / Crew & Shifts / Payroll Report',
            summaryMl:
              'Assign a Unique ID and Date of Birth to every crew member, select Per-Hour, Per-Event, or Monthly pay, protect historical shift rates, and separate Salary Advances.',
            stepsMl: [
              'Open "Staff -> + Add Staff" to enter the staff member’s Full Name, Unique ID (auto-generated via "Auto ID" or custom unique code), Date of Birth, and Mobile Number, and select their salary structure upfront: Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month).',
              'When editing a staff member’s salary rate, choose your "Existing Event Shifts Rate Policy": by default, all previously assigned shifts keep their original locked rate, while newly assigned shifts use the new rate—or explicitly opt to switch upcoming shifts (or click "Switch to New Pricing" on any individual shift/event).',
              'Click the amber "Salary Advance" button to record mid-month advances separately from Standard Salary Payouts across KPIs, ledgers, and A4 Salary Slips.',
              'Open "Payroll Report & Salary Slips" to export date-range Payroll Summary PDFs or individual A4 Staff Salary Slips.'
            ],
            importantNoteMl:
              'If a staff member or user forgets their password, they can click "Forgot Password?" on the Sign-In screen and verify ANY TWO (2) of: Unique ID, Phone Number, or Date of Birth—or an admin can click "Reset PW" on their profile.'
          },
          {
            number: '07',
            titleMl: 'Forward-Only Stock Price Updates & Confidential Owner Profit & Loss',
            menuLabel: 'Stock / Profit & Loss',
            summaryMl:
              'Update fluctuating ingredient prices for future events without altering past event stock costs, and audit true Owner-only net margins.',
            stepsMl: [
              'Whenever you update an ingredient’s unit cost in "Stock" or record a new "Vendor Stock Purchase" at today’s market price, IPPAS Pulse locks the previous unit cost on all existing events so historical quotes, stock requisitions, and P&L records remain untouched while new bookings use the updated price.',
              'Open "Profit & Loss" (visible exclusively to the Owner) to inspect contract revenue against raw-material stock pricing, extras/rentals cost, locked staff wages + allowances, and miscellaneous event expenses.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Full Database Backup, Disaster Restore, 15-Day Reminder & Bilingual Manuals',
        chapters: [
          {
            number: '08',
            titleMl: 'Full Database Backup (.json / Excel / CSV) & Full Restore After Reset',
            menuLabel: 'Settings (or Dashboard) -> Full Database Backup & Restore',
            summaryMl:
              'Download a complete restorable snapshot of all business records—including historical price locks—and restore 100% of your data anytime.',
            stepsMl: [
              'Open "Settings" (or the Backup card on the Owner Dashboard) and click "Download Full Restorable Backup (.json)" to save clients, menus, recipes, stock, vendor bills, events, historical price locks, shifts, payroll/advances, invoices, payments, and team accounts.',
              'Export multi-sheet ".xlsx" Excel workbooks or module-wise ".csv" spreadsheets anytime for offline accounting.',
              'If the database is ever reset, upload your ".json" backup file under "Restore Full Database from Backup File", review the record-count preview, and click "Confirm & Restore Full Database Now".'
            ],
            importantNoteMl:
              'Automated 15-Day Backup Notification: Every 15 days after your last backup download, a reminder appears in your Owner Notification Bell and Dashboard until you download a fresh backup.'
          },
          {
            number: '09',
            titleMl: 'Activity Notifications, User Unique IDs & English/Malayalam Manuals',
            menuLabel: 'Bell Icon / More -> Users / Settings / Manuals',
            summaryMl:
              'Inspect team edits quietly inside the Notification Bell, manage role Unique IDs & DOBs, and download official User Manuals in English or Malayalam.',
            stepsMl: [
              'Click the Notification Bell in the top bar whenever an unread badge appears to review exact "Previous Data -> Updated Data" edit logs without intrusive popups.',
              'Open "More -> Users" to create or edit Manager, Accountant, and Staff accounts complete with Unique ID, Date of Birth, and Phone Number (or update your own 2-of-3 recovery details in "Settings"), and open "More -> Manuals" to download the 4 official role-based A4 PDF User Manuals in English or Malayalam.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Assign event crew shifts before finalizing a client quotation so the mandatory "Labour Charges" line item reflects exact staffing costs automatically.',
      'Update daily market ingredient prices and menu dish rates freely—IPPAS Pulse automatically protects all previous events, quotes, and invoices from retroactive changes.',
      'Download the "Full Restorable Backup (.json)" whenever the 15-day Owner Backup Reminder appears and store a copy safely in cloud storage.',
      'Always use the dedicated "Salary Advance" button for mid-month staff advances so standard salary settlements remain crystal clear.'
    ]
  },

  manager: {
    key: 'manager',
    pdfFilename: 'IPPAS-Manager-User-Manual-EN.pdf',
    docCode: 'DOC-EN-MANAGER-02',
    malayalamRoleName: 'Manager',
    englishRoleLabel: 'Manager',
    titleMl: 'Manager User Manual (English Edition)',
    subtitleMl:
      'Complete Operations Guide to Client Onboarding, Menu Recipes, Mandatory Quotation Labour Charges, Forward-Only Stock & Menu Pricing, and Staff Shift Rate Control',
    accentColor: '#1d4ed8',
    overviewMl:
      'The Manager workspace in IPPAS Pulse streamlines day-to-day catering operations in Calicut—from registering enquiries and reviewing Top Clients to building event quotations with automatic crew Labour Charges, adding non-stock recipe ingredients on the fly, updating daily stock and menu prices without affecting past bookings, exporting vendor shortage CSVs, and managing crew shifts with locked or switchable salary rates.',
    accessibleModulesMl: [
      'Dashboard (Operations Overview, Upcoming Functions, Low-Stock & Expiry Alerts)',
      'Events (Upcoming vs Previous Bookings, Mandatory Quotation Labour Charges, Shortage CSV & WhatsApp PDF+Text)',
      'Stock (Warehouse Inventory, Forward-Only Price Updates, Expiry Tracking, CSV Export & Vendor Purchases)',
      'Staff (Onboarding with 3 Salary Plans, Shift Rate Lock or Switch, Attendance & WhatsApp Duty Alerts)',
      'More Menu -> Clients (Top Clients Leaderboard), Menu & Recipes & Bilingual Manuals (EN / ML)'
    ],
    pages: [
      {
        pageTitleMl: 'App Setup, Operations Dashboard, Clients & Menu Rate Protection',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 2-of-3 Password Reset, App Install & Operations Dashboard',
            menuLabel: 'Login / Forgot Password? / Install App / Dashboard',
            summaryMl:
              'Sign in, recover forgotten passwords using any 2 of Unique ID, Phone, or Date of Birth, and access live event schedules.',
            stepsMl: [
              'Sign in using your Manager username (or Unique ID) and password. If you ever forget your password, click "Forgot Password?" on the Sign-In screen and verify ANY TWO (2) of your Unique ID, Phone Number, or Date of Birth to set a new password.',
              'Tap "Install App" once to add IPPAS Pulse to your phone’s App Drawer and Home Screen without needing any special device permissions (on iPhone Safari, tap Share -> "Add to Home Screen").',
              'Use the Operations Dashboard to review confirmed upcoming bookings, total guest pax, low-stock ingredients, and items approaching expiry.'
            ]
          },
          {
            number: '02',
            titleMl: 'Top Clients Leaderboard, Menu Recipes & Historical Dish Rate Lock',
            menuLabel: 'More -> Clients / Menu & Recipes',
            summaryMl:
              'Identify top-performing clients instantly, create non-stock recipe ingredients, and update menu prices safely.',
            stepsMl: [
              'Open "Clients" to add customer profiles and view the "Top Clients Leaderboard" highlighting "Highest Paying Clients" and "Most Events Conducted".',
              'Open "Menu & Recipes" to add dishes (Per Guest or Per Kg) and click "Edit Recipe". Use "+ Create New Ingredient (Not in Stock)" right inside the recipe modal whenever an ingredient is not yet in warehouse inventory.',
              'When you revise a dish’s price (e.g., ₹100 today to ₹120 tomorrow), only new quotes and newly added dishes use ₹120—all previous events, quotes, and invoices automatically keep ₹100.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Catering Bookings, Mandatory Labour Charges & Forward-Only Stock Pricing',
        chapters: [
          {
            number: '03',
            titleMl: 'Bookings, Mandatory Quotation "Labour Charges", Print & WhatsApp Sharing',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'Prepare accurate catering proposals that automatically include assigned crew salary totals as "Labour Charges".',
            stepsMl: [
              'Open "Events" to view "Upcoming Bookings" separated from "Previous / Completed Events", or click "+ New Booking" to register a function.',
              'Assign crew shifts in the event’s "Staff Shifts" section: the total salary of all assigned (non-absent) crew members is automatically added as a mandatory "Labour Charges" item in the event’s Quotation Builder, A4 PDF, Printout, and WhatsApp summary.',
              'Click "Print Proposal" to print ONLY the standalone A4 quotation, or click "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" to send both the PDF and message together.'
            ]
          },
          {
            number: '04',
            titleMl: 'Warehouse Inventory, Forward-Only Stock Costs & Shortage CSV Export',
            menuLabel: 'Stock / Event Sufficiency',
            summaryMl:
              'Update daily market raw-material prices for future bookings without changing past event costs, and export vendor shortage CSVs.',
            stepsMl: [
              'Open "Stock" to add raw materials, track batch expiry dates, record "Vendor Stock Purchases", or run a "Bulk Stock Update" after physical counts.',
              'Updating an ingredient’s unit price or logging a new vendor purchase updates stock costing ONLY for future events—previously created events retain their locked historical ingredient costs.',
              'Click "Export Inventory & Shortage CSV" on the Stock page (or inside an Event’s Stock Sufficiency panel) to download exact shortage quantities for vendor ordering.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Staff Salary Plans, Shift Rate Lock / Switch, Attendance & Expenses',
        chapters: [
          {
            number: '05',
            titleMl: 'Staff Unique ID & DOB Registration, Salary Plans & Shift Rate Control',
            menuLabel: 'Staff -> + Add Staff / Event -> Crew Shifts',
            summaryMl:
              'Assign a Unique ID and Date of Birth when adding staff, choose Per-Hour, Per-Event, or Monthly pay, and manage shift rates and attendance.',
            stepsMl: [
              'In "Staff -> + Add Staff", enter the crew member’s Full Name, Unique ID (auto-generated via "Auto ID" or custom unique code), Date of Birth, and Mobile Number, and select their salary plan upfront: Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month).',
              'Each assigned event shift locks the staff member’s rate active at assignment time. If a staff member’s pay rate is later updated, existing shifts stay at their historical assigned rate by default—or you can switch upcoming/specific shifts to the new pricing using the Edit Staff rate policy or the 1-click "Switch to New Pricing" button on the shift row.',
              'After each function, mark crew shifts "Present" or "Absent", log actual event expenses under the Expenses tab, and remind crew members they can reset a forgotten password anytime on the Sign-In screen using any 2 of their Unique ID, Phone Number, or Date of Birth.'
            ],
            importantNoteMl:
              'Only shifts marked "Present" count toward final Per-Hour and Per-Event payroll—always verify attendance right after every event.'
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Assign crew shifts on every event so the mandatory "Labour Charges" quotation item calculates staffing costs accurately.',
      'Check Event Stock Sufficiency 48 hours before every confirmed event and export the Shortage CSV for vendor procurement.',
      'Keep existing completed shifts locked at their historical rate when revising staff pay, and switch only upcoming shifts when agreed.'
    ]
  },

  accountant: {
    key: 'accountant',
    pdfFilename: 'IPPAS-Accountant-User-Manual-EN.pdf',
    docCode: 'DOC-EN-ACCOUNTANT-02',
    malayalamRoleName: 'Accountant',
    englishRoleLabel: 'Accountant',
    titleMl: 'Accountant User Manual (English Edition)',
    subtitleMl:
      'Complete Accounting Guide to Immutable Client Billing, Mandatory Quotation Labour Charges, Bank vs Cash Treasury, Separated Salary Advances, and Locked Payroll Rates',
    accentColor: '#047857',
    overviewMl:
      'The Accountant workspace in IPPAS Pulse centralizes all receivables, payables, and payroll operations—covering immutable client invoices, mandatory quotation Labour Charges verification, bank vs cash collection tracking, Top Clients revenue rankings, forward-only vendor purchase costing, event expense vouchers, locked historical staff shift rates, separated Salary Advances, and printable A4 Salary Slips.',
    accessibleModulesMl: [
      'Dashboard (Financial Overview, Receivables, Payables & Bank vs Cash Treasury)',
      'Invoices (Locked Historical Invoices, Discounts, Part Payments, Final Settlement & WhatsApp PDF+Text)',
      'Events (Quotation Totals with Mandatory Labour Charges, Billing Status & 4-Head Expense Ledger)',
      'Staff (Locked Shift Rates, Switch-to-New-Rate Control, Quick Salary Advance & A4 Salary Slip PDFs)',
      'Stock (Vendor Purchase Bills, Forward-Only Stock Costing & Supplier Settlements)',
      'More Menu -> Clients (Top Clients Leaderboard) & Bilingual Manuals (EN / ML)'
    ],
    pages: [
      {
        pageTitleMl: 'Financial Dashboard, Treasury Reconciliation & Immutable Client Billing',
        chapters: [
          {
            number: '01',
            titleMl: 'Sign-In, 2-of-3 Password Reset, Treasury Holdings & Top Clients',
            menuLabel: 'Login / Forgot Password? / Dashboard / More -> Clients',
            summaryMl:
              'Sign in securely, recover forgotten passwords using 2-of-3 verification, and track bank vs cash balances and top clients.',
            stepsMl: [
              'Sign in with your Accountant credentials (or Unique ID) and tap "Install App" once to add IPPAS Pulse to your desktop or smartphone. If you ever forget your password, click "Forgot Password?" on the Sign-In screen and verify ANY TWO (2) of your Unique ID, Phone Number, or Date of Birth.',
              'Review "Account-wise Invoice Collections" on the Dashboard to reconcile exact amounts received in each Bank/UPI account versus Cash in Hand.',
              'Open "More -> Clients" to inspect the "Top Clients Leaderboard" ("Highest Paying Clients" and "Most Events Conducted") and monitor client-wise pending receivables.'
            ]
          },
          {
            number: '02',
            titleMl: 'Locked Historical Quotes/Invoices, Mandatory "Labour Charges" & Payments',
            menuLabel: 'Events / Invoices',
            summaryMl:
              'Verify automatic crew Labour Charges on quotations and issue locked invoices that never change when future prices fluctuate.',
            stepsMl: [
              'Every event quotation automatically includes a mandatory "Labour Charges" line item calculated from the total assigned crew salaries for that booking.',
              'Convert approved proposals into sequentially numbered invoices (INV-...): each invoice permanently locks its dish names, dish rates, and extras snapshot so future menu, stock, or staff rate updates never alter issued bills.',
              'Record client advances and part payments with exact Bank/UPI account or Cash in Hand selection. Once paid in full, the invoice automatically becomes a "Final Settlement Invoice".',
              'Use "Print" for standalone A4 printing or "Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" to share bills cleanly.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'Staff Payroll Rate Protection, Salary Advances & Salary Slip PDFs',
        chapters: [
          {
            number: '03',
            titleMl: 'Historical Shift Rate Protection & Separated "Salary Advance" Button',
            menuLabel: 'Staff -> Crew & Shifts',
            summaryMl:
              'Audit exact shift rates locked at assignment time and keep mid-month Salary Advances strictly separated from Standard Salary Payouts.',
            stepsMl: [
              'Open "Staff" to view each crew member’s pay structure—Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month)—along with each shift’s locked assigned rate.',
              'If a staff member’s rate was increased later, past shifts remain calculated at their original assigned rate unless explicitly switched to the new rate via the Edit Staff policy or per-shift switch button.',
              'Click the amber "Salary Advance" button for mid-month advances and "Pay Salary" for Standard Salary Payouts so both remain clearly separated across KPI cards, ledgers, Excel/CSV exports, and Salary Slips.'
            ],
            importantNoteMl:
              'Never mix advance disbursements into regular salary notes—always use the dedicated "Salary Advance" button for clean audit trails.'
          },
          {
            number: '04',
            titleMl: 'Date-Range Payroll Reports & Printable A4 Staff Salary Slips',
            menuLabel: 'Staff -> Payroll Report & Salary Slips',
            summaryMl:
              'Generate custom date-range payroll summaries honoring historical shift/monthly rates and export official A4 Salary Slip PDFs.',
            stepsMl: [
              'Open the "Payroll Report & Salary Slips" tab on the Staff page and select your Start Date and End Date (or tap "This Month" / "Last Month").',
              'Review period hours worked, shifts attended at their effective locked rates, allowances, Standard Salary Paid, Salary Advances Taken, and closing payable balance.',
              'Click "Slip PDF", "Print", or "WhatsApp" on any row to issue standalone A4 Staff Salary Slips.'
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
              'Settle supplier bills safely with forward-only stock price updates and log complete event expenditure vouchers.',
            stepsMl: [
              'Open "Stock -> Vendor Purchases" to record raw-material bills at current market rates and click "Record Payment" as supplier credit dues are cleared—existing historical events remain locked at their original ingredient costs.',
              'Open any booking under "Events -> Expenses" to verify the 4 operational cost heads: (1) Stock Pricing, (2) Extras Taken Cost, (3) Staff Extra Expenses, and (4) Other Expenses, and print standalone A4 Expense Sheets.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Always verify the exact destination Bank Account vs Cash in Hand before saving any client invoice payment.',
      'Confirm crew shifts are assigned before converting an event quotation to an invoice so "Labour Charges" are captured accurately.',
      'Use the "Payroll Report & Salary Slips" date-range view at month-end to export batch A4 Salary Slips for accounting archives.'
    ]
  },

  staff: {
    key: 'staff',
    pdfFilename: 'IPPAS-Staff-User-Manual-EN.pdf',
    docCode: 'DOC-EN-STAFF-02',
    malayalamRoleName: 'Staff',
    englishRoleLabel: 'Staff',
    titleMl: 'Staff User Manual (English Edition)',
    subtitleMl:
      'Simple Crew Guide to Mobile Sign-In, Self-Service Password Reset, 1-Tap App Install, Upcoming vs Attended Events, Locked Shift Rates, and Salary & Advance Tracking',
    accentColor: '#6d28d9',
    overviewMl:
      'The IPPAS Pulse Staff Portal gives every catering crew member, chef, captain, and server a clean, mobile-friendly view of their upcoming catering duties, Google Maps venue locations, completed event history, assigned shift rate locked on each event, configured salary plan (Per Hour, Per Event, or Monthly Fixed), Standard Salary Received, Salary Advances taken, and exact Pending Balance Payable.',
    accessibleModulesMl: [
      'My Portal (Upcoming Events, Attended Events History, Assigned Shift Rates & Salary / Advance Summary)',
      'Manuals (Downloadable Official Staff User Manual A4 PDF in English or Malayalam)',
      'Profile / Menu -> Change Password & Secure Logout'
    ],
    pages: [
      {
        pageTitleMl: 'Mobile Sign-In, Password Recovery & 1-Tap Smartphone App Install',
        chapters: [
          {
            number: '01',
            titleMl: 'Signing In & 2-of-3 Self-Service Forgot Password Reset',
            menuLabel: 'Sign In / Forgot Password? (Select Any 2 of 3)',
            summaryMl:
              'Log in with your registered mobile number or Unique ID, and reset a forgotten password by verifying any 2 of your Unique ID, Phone Number, or Date of Birth.',
            stepsMl: [
              'Open IPPAS Pulse on your smartphone and enter your registered 10-digit mobile number (or your assigned Staff Unique ID, e.g., STF-001) in the Sign-In field.',
              'Enter your password and tap "Sign In" to open your personal Staff Duty & Salary Portal, where your Unique ID, Phone Number, and Date of Birth are displayed in your header banner.',
              'If you ever forget your password, tap "Forgot Password?" on the Sign-In screen, select ANY TWO (2) out of the THREE (3) verification options — (1) Unique ID, (2) Phone Number, or (3) Date of Birth — enter those two matching details, and save your new password immediately.'
            ],
            importantNoteMl:
              'Password recovery strictly requires matching any 2 of your 3 personal identifiers (Unique ID, Phone Number, or Date of Birth). Keep Mobile Data or Wi-Fi turned on so your latest shifts and salary updates sync automatically.'
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
        pageTitleMl: 'Upcoming Duties, Attended Events, Locked Shift Rates & Advances',
        chapters: [
          {
            number: '03',
            titleMl: 'Checking Upcoming Events, Attended Events & Assigned Shift Rates',
            menuLabel: 'My Portal -> Upcoming Events / Attended Events',
            summaryMl:
              'View your next scheduled catering function, venue map, and the exact pay rate assigned to each event shift.',
            stepsMl: [
              'Under "Upcoming Events", check your "Next Scheduled Duty" card for the event date, reporting and closing times, assigned role, guest count, "Assigned Rate", duty instructions, and the 1-tap "Open Venue in Google Maps" button.',
              'Scroll to "Events Attended So Far" (or tap the filter tab) to see every completed catering event you worked, hours logged, the locked shift rate active for that event, attendance status ("Attended" vs "Attendance Pending"), and exact shift earnings.',
              'If your salary rate is revised in the future, all previously completed shifts safely keep their original assigned rate while new shifts automatically reflect your updated rate.'
            ]
          },
          {
            number: '04',
            titleMl: 'Understanding Your Salary Plan, Standard Payouts & Salary Advances',
            menuLabel: 'My Portal -> Salary KPIs & Payouts Table',
            summaryMl:
              'Track your total earnings, regular salary payouts, salary advances, and remaining balance transparently.',
            stepsMl: [
              'Your current pay plan—Per Hour (₹/hr), Per Event (₹/event), or Monthly Fixed Salary (₹/month)—is displayed clearly at the top of your portal.',
              'The 4 summary cards show: (1) Total Salary Earned (including any extra duty allowances/bonuses), (2) Standard Salary Paid, (3) Salary Advances Taken (tracked separately), and (4) Pending Balance Payable.',
              'Open "Salary Payouts & Advances Received" to see every payment date, whether it was a "Standard Salary" payout or a "Salary Advance", payment method (Cash / UPI / Bank), and exact amount.'
            ]
          },
          {
            number: '05',
            titleMl: 'Changing Password, Downloading English or Malayalam PDF & Signing Out',
            menuLabel: 'Change Password / Manuals / Logout',
            summaryMl:
              'Keep your personal salary portal private and save this User Manual in either English or Malayalam on your phone.',
            stepsMl: [
              'Tap "Change Password" in your portal header (or bottom Menu) after your first login to set a private password known only to you.',
              'Tap "Staff User Manual (PDF)" anytime to download the official A4 Staff User Manual in either English or Malayalam for offline reading.',
              'Always tap "Logout" if you sign in from a shared phone or office computer.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'Open IPPAS Pulse the evening before every scheduled function to double-check your reporting time, assigned rate, duty note, and Google Maps venue pin.',
      'After completing an event shift, verify that your attendance is marked "Attended" so your earnings reflect immediately.',
      'Keep your password private so your salary and advance records remain confidential.'
    ]
  }
};

/**
 * OFFICIAL MALAYALAM EDITION USER MANUALS (4 Roles: Owner, Manager, Accountant, Staff)
 * Note: Malayalam text is strictly confined to User Manuals; the rest of IPPAS Pulse operates 100% in English.
 */
export const MALAYALAM_EDITION_USER_MANUALS: Record<ManualRoleKey, RoleUserManual> = {
  owner: {
    key: 'owner',
    pdfFilename: 'IPPAS-Owner-User-Manual-ML.pdf',
    docCode: 'DOC-ML-OWNER-02',
    malayalamRoleName: 'ഉടമ (Owner)',
    englishRoleLabel: 'Owner',
    titleMl: 'ഓണർ യൂസർ മാനുവൽ (Owner User Manual)',
    subtitleMl:
      'കാറ്ററിംഗ് ബുക്കിംഗുകൾ, ക്വട്ടേഷനിലെ നിർബന്ധിത Labour Charges, പഴയ നിരക്കുകളുടെ സംരക്ഷണം (Price Lock), സ്റ്റാഫ് ശമ്പളം, ലാഭ-നഷ്ട കണക്കുകൾ (P&L), ഡാറ്റാബേസ് ബാക്കപ്പ് എന്നിവയ്ക്കുള്ള സമ്പൂർണ്ണ മലയാളം സഹായി',
    accentColor: '#be123c',
    overviewMl:
      'കോഴിക്കോട് (Calicut) കേന്ദ്രീകരിച്ചുള്ള ഔട്ട്ഡോർ കാറ്ററിംഗ് & ഇവന്റ് മാനേജ്‌മെന്റ് പ്രവർത്തനങ്ങൾ പൂർണ്ണമായി നിയന്ത്രിക്കുന്നതിനുള്ള അക്കൗണ്ടാണ് Owner (ഉടമ) അക്കൗണ്ട്. പുതിയതും കഴിഞ്ഞുപോയതുമായ ബുക്കിംഗുകൾ, Top Clients ലിസ്റ്റ്, മെനു റെസിപ്പികൾ, സ്റ്റാഫ് ശമ്പളം ഉൾപ്പെടുത്തിയ ക്വട്ടേഷനുകൾ, ഇൻവോയ്‌സുകൾ, ഗോഡൗൺ സ്റ്റോക്ക്, സ്റ്റാഫ് പേറോൾ, ഓണർക്ക് മാത്രം കാണാവുന്ന ലാഭ-നഷ്ട (Profit & Loss) കണക്കുകൾ, മുഴുവൻ ഡാറ്റാബേസ് ബാക്കപ്പ് & റീസ്റ്റോർ എന്നിവ ഇതിലൂടെ കൈകാര്യം ചെയ്യാം. ആപ്പിന്റെ സ്ക്രീനുകളും ബട്ടണുകളും ലളിതമായ ഇംഗ്ലീഷിലാണ് ക്രമീകരിച്ചിരിക്കുന്നത്. Owner, Manager, Accountant, Staff എന്നീ നാല് യൂസർ റോളുകളാണ് ആപ്പിലുള്ളത്.',
    accessibleModulesMl: [
      'Dashboard (വരുമാനം, ലാഭം, ബാങ്ക്/ക്യാഷ് കണക്കുകൾ, 15 ദിവസത്തെ ബാക്കപ്പ് ഓർമ്മപ്പെടുത്തൽ)',
      'Events (വരുന്നവയും കഴിഞ്ഞവയുമായ ബുക്കിംഗുകൾ, ക്വട്ടേഷൻ Labour Charges, WhatsApp PDF+Text)',
      'Invoices (മാറ്റം വരാത്ത പഴയ ബില്ലുകൾ, ഡിസ്കൗണ്ട്, പാർട്ട് പേയ്‌മെന്റ്, Final Settlement)',
      'Profit & Loss (ഓണർക്ക് മാത്രം കാണാവുന്ന ഓരോ ഇവന്റിന്റെയും കൃത്യമായ ലാഭ-നഷ്ട കണക്ക്)',
      'Stock (സ്റ്റോക്ക് വിവരങ്ങൾ, പുതിയ ഇവന്റുകൾക്ക് മാത്രമുള്ള വില മാറ്റം, Expiry അലേർട്ട്, CSV)',
      'Staff (മണിക്കൂർ / ഇവന്റ് / മാസ ശമ്പളം, പഴയ ഷിഫ്റ്റ് നിരക്ക് സംരക്ഷണം, Salary Advance, PDF സ്ലിപ്പ്)',
      'More Menu -> Clients (Top Clients), Menu & Recipes, Users, Settings & Manuals (EN / ML)'
    ],
    pages: [
      {
        pageTitleMl: 'ആപ്പ് ഇൻസ്റ്റാളേഷൻ, ഓണർ ഡാഷ്‌ബോർഡ് & ടോപ്പ് ക്ലൈന്റ്സ്',
        chapters: [
          {
            number: '01',
            titleMl: 'സൈൻ-ഇൻ, 2-of-3 പാസ്‌വേഡ് റീസെറ്റ് & സ്മാർട്ട്‌ഫോൺ ആപ്പ് ഇൻസ്റ്റാളേഷൻ',
            menuLabel: 'Login / Forgot Password? / Install App',
            summaryMl:
              'സുരക്ഷിതമായി ലോഗിൻ ചെയ്യാനും, പാസ്‌വേഡ് മറന്നാൽ 3 ഓപ്ഷനുകളിൽ ഏതെങ്കിലും 2 എണ്ണം നൽകി സ്വയം റീസെറ്റ് ചെയ്യാനും, ഫോണിൽ ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യാനുമുള്ള വിധം.',
            stepsMl: [
              'IPPAS Pulse തുറന്ന് നിങ്ങളുടെ Owner യൂസർനെയിമും (അല്ലെങ്കിൽ Unique ID / ഫോൺ നമ്പറും) പാസ്‌വേഡും നൽകി "Sign In" ക്ലിക്ക് ചെയ്യുക.',
              'ആപ്പിലെ ഏതൊരു ഉപയോക്താവിനും (Owner, Manager, Accountant, Staff) പാസ്‌വേഡ് മറന്നുപോയാൽ ലോഗിൻ സ്ക്രീനിലെ "Forgot Password?" ക്ലിക്ക് ചെയ്ത് Unique ID, Phone Number, Date of Birth (ജനനത്തീയതി) എന്നിവയിൽ ഏതെങ്കിലും രണ്ട് (2) ഓപ്ഷനുകൾ തിരഞ്ഞെടുത്ത് വിവരങ്ങൾ നൽകി ഉടൻ പുതിയ പാസ്‌വേഡ് സെറ്റ് ചെയ്യാം.',
              'ആൻഡ്രോയിഡ് ഫോണിലോ കമ്പ്യൂട്ടറിലോ "Install App" ബട്ടൺ അമർത്തിയാൽ ഫോണിലെ മറ്റ് ആപ്പുകളുടെ കൂടെയും ഹോം സ്ക്രീനിലും IPPAS Pulse ഐക്കൺ ഉടൻ വരുന്നതാണ്—ഇതിന് പ്രത്യേക പെർമിഷനുകളുടെ ആവശ്യമില്ല (iPhone Safari-യിൽ Share -> "Add to Home Screen" തിരഞ്ഞെടുക്കുക).',
              'ഡെസ്ക്ടോപ്പിൽ മുകളിലെ നാവിഗേഷൻ ബാറും ("More" മെനു സഹിതം), ഫോണിൽ താഴെയുള്ള 5 ടാബുകളും "Menu" ബട്ടണും ഉപയോഗിച്ച് എല്ലാ പേജുകളിലേക്കും വേഗത്തിൽ എത്താം.'
            ],
            importantNoteMl:
              'Owner, Manager, Accountant, Staff എന്നീ നാല് വിഭാഗം ഉപയോക്താക്കൾക്കും അവരവരുടെ ചുമതലകൾക്ക് അനുസരിച്ചുള്ള വിവരങ്ങൾ മാത്രമേ കാണാൻ സാധിക്കൂ.'
          },
          {
            number: '02',
            titleMl: 'ഓണർ ഡാഷ്‌ബോർഡ്, ബാങ്ക്/ക്യാഷ് കണക്കുകൾ & Top Clients ലിസ്റ്റ്',
            menuLabel: 'Dashboard / More -> Clients',
            summaryMl:
              'ആകെ വരുമാനം, അറ്റാദായം, ബാങ്ക്/ക്യാഷ് ബാലൻസ്, ഏറ്റവും മികച്ച ക്ലൈന്റ്സ് എന്നിവ തത്സമയം പരിശോധിക്കാം.',
            stepsMl: [
              'Dashboard-ലെ 4 പ്രധാന കാർഡുകളിലൂടെ ആകെ വരുമാനം (Total Revenue), പൂർത്തിയായ ഇവന്റുകളിലെ ലാഭം/നഷ്ടം (Owner-ക്ക് മാത്രം), കിട്ടാനുള്ള തുക (Pending Receivables), വരാനിരിക്കുന്ന ബുക്കിംഗുകൾ എന്നിവ കാണാം.',
              '"Account-wise Invoice Collections" വിഭാഗത്തിൽ ഓരോ ബാങ്ക്/UPI അക്കൗണ്ടിലും ഓഫീസ് ക്യാഷിലും (Cash in Hand) എത്ര രൂപ വീതം വന്നിട്ടുണ്ടെന്ന് കൃത്യമായി അറിയാം.',
              '"More -> Clients" തുറന്നാൽ ഏറ്റവും കൂടുതൽ തുക നൽകിയവരെയും ("Highest Paying Clients") ഏറ്റവും കൂടുതൽ ഇവന്റുകൾ നടത്തിയവരെയും ("Most Events Conducted") കാണിക്കുന്ന "Top Clients Leaderboard" മുകളിൽ തന്നെ കാണാം.',
              '"All Clients", "Highest Paying", "Most Events" എന്നീ ഫിൽട്ടറുകൾ ഉപയോഗിച്ച് ക്ലൈന്റ് ലിസ്റ്റ് തരംതിരിക്കാം.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'മെനു വില സംരക്ഷണം, ക്വട്ടേഷനിലെ Labour Charges & ഇൻവോയ്‌സുകൾ',
        chapters: [
          {
            number: '03',
            titleMl: 'മെനു റെസിപ്പികളും പഴയ ഇവന്റുകളിലെ മെനു നിരക്ക് സംരക്ഷണവും',
            menuLabel: 'More -> Menu & Recipes',
            summaryMl:
              'സ്റ്റോക്കിൽ ഇല്ലാത്ത ചേരുവകൾ റെസിപ്പിയിൽ ചേർക്കാനും, പഴയ ക്വട്ടേഷനുകൾക്ക് മാറ്റം വരാതെ മെനു വില പുതുക്കാനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Menu & Recipes" തുറന്ന് "+ Add Dish" വഴി പ്ലേറ്റ് നിരക്കിലോ (Per Guest) കിലോ നിരക്കിലോ (Per Kg) വിഭവങ്ങൾ ചേർക്കുക.',
              '"Edit Recipe" ക്ലിക്ക് ചെയ്ത് ഓരോ വിഭവത്തിനും വേണ്ട ചേരുവകളുടെ അളവ് നൽകാം. ഗോഡൗൺ സ്റ്റോക്കിൽ ഇല്ലാത്ത പുതിയൊരു ചേരുവയാണ് വേണ്ടതെങ്കിൽ റെസിപ്പി വിൻഡോയിൽ തന്നെയുള്ള "+ Create New Ingredient (Not in Stock)" ക്ലിക്ക് ചെയ്ത് ഉടൻ ചേർക്കാവുന്നതാണ്.',
              'ഒരു മെനു ഐറ്റത്തിന്റെ വില ഇന്ന് ₹100-ൽ നിന്ന് നാളെ ₹120 ആയി അപ്‌ഡേറ്റ് ചെയ്താൽ, പുതുതായി ഉണ്ടാക്കുന്ന ക്വട്ടേഷനുകളിൽ മാത്രമേ ₹120 വരികയുള്ളൂ. മുൻപ് നൽകിയ ഇവന്റുകളിലെയും ക്വട്ടേഷനുകളിലെയും ഇൻവോയ്‌സുകളിലെയും ₹100 നിരക്കിന് യാതൊരു മാറ്റവും വരുന്നതല്ല.'
            ]
          },
          {
            number: '04',
            titleMl: 'ഇവന്റ് ക്വട്ടേഷനിലെ നിർബന്ധിത "Labour Charges", പ്രിന്റ് & WhatsApp ഷെയറിംഗ്',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'ഇവന്റിലേക്ക് നിയോഗിച്ച സ്റ്റാഫുകളുടെ ആകെ ശമ്പളം "Labour Charges" ആയി എല്ലാ ക്വട്ടേഷനിലും ഓട്ടോമാറ്റിക്കായി ഉൾപ്പെടുന്നു.',
            stepsMl: [
              '"Events" പേജിൽ വരാനിരിക്കുന്ന പരിപാടികളും ("Upcoming Bookings") കഴിഞ്ഞുപോയ പരിപാടികളും ("Previous / Completed Events") വെവ്വേറെ കാണാം.',
              'ഒരു ഇവന്റിൽ "Staff Shifts" വിഭാഗത്തിൽ സ്റ്റാഫുകളെ അസൈൻ ചെയ്യുമ്പോൾ, ആ ഇവന്റിലെ സ്റ്റാഫുകളുടെ ആകെ ശമ്പള തുക കണക്കാക്കി "Labour Charges" എന്ന പേരിൽ ക്വട്ടേഷനിൽ (Proposal PDF, Print, WhatsApp സന്ദേശം എന്നിവയിലെല്ലാം) നിർബന്ധമായും ഓട്ടോമാറ്റിക്കായി ചേർക്കപ്പെടുന്നു.',
              'ഏത് ഡോക്യുമെന്റിന്റെയും "Print" ഐക്കൺ ക്ലിക്ക് ചെയ്താൽ വെബ് പേജ് ഭാഗങ്ങൾ ഒന്നും ഉൾപ്പെടാതെ ആ A4 ഡോക്യുമെന്റ് മാത്രമായി പ്രിന്റ് ലഭിക്കും.',
              '"Send on WhatsApp" -> "Send PDF & Text Together on WhatsApp" അമർത്തുമ്പോൾ സ്മാർട്ട്‌ഫോണുകളിൽ PDF ഫയലും സന്ദേശവും ഒരുമിച്ച് ഓട്ടോമാറ്റിക്കായി അറ്റാച്ച് ആകും (കമ്പ്യൂട്ടർ വെബ് വ്യൂവിൽ മാത്രം WhatsApp Web-നായി "Copy Text" ബട്ടൺ കാണിക്കും).'
            ]
          },
          {
            number: '05',
            titleMl: 'മാറ്റം വരാത്ത ഇൻവോയ്‌സുകൾ, ഡിസ്കൗണ്ട് & Final Settlement',
            menuLabel: 'Invoices',
            summaryMl:
              'ക്വട്ടേഷൻ ഇൻവോയ്‌സ് ആക്കി മാറ്റാനും, തവണകളായുള്ള പേയ്‌മെന്റുകൾ രേഖപ്പെടുത്താനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Approve Quote & Convert to Invoice" (അല്ലെങ്കിൽ "+ Create Invoice") വഴി ഇൻവോയ്‌സ് തയ്യാറാക്കുമ്പോൾ അതിലെ എല്ലാ നിരക്കുകളും സുരക്ഷിതമായി ലോക്ക് ചെയ്യപ്പെടുന്നു—പിന്നീട് സ്റ്റോക്ക്/മെനു/സ്റ്റാഫ് വിലകൾ മാറിയാലും പഴയ ഇൻവോയ്‌സുകളിൽ മാറ്റം വരില്ല.',
              'ഡിസ്കൗണ്ടുകളും ബാങ്ക്/UPI അല്ലെങ്കിൽ ക്യാഷ് മുഖേന ലഭിക്കുന്ന പാർട്ട് പേയ്‌മെന്റുകളും കൃത്യമായി രേഖപ്പെടുത്താം.',
              'മുഴുവൻ തുകയും ലഭിച്ചു കഴിയുമ്പോൾ ബിൽ ഓട്ടോമാറ്റിക്കായി "Final Settlement Invoice" ആയി മാറുന്നു.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'സ്റ്റാഫ് ശമ്പള നിരക്ക് സംരക്ഷണം, സ്റ്റോക്ക് വില അപ്‌ഡേറ്റ് & P&L',
        chapters: [
          {
            number: '06',
            titleMl: 'സ്റ്റാഫ് Unique ID & ജനനത്തീയതി (DOB), 3 തരം ശമ്പളം & Salary Advance',
            menuLabel: 'Staff -> + Add Staff / Crew & Shifts / Payroll Report',
            summaryMl:
              'സ്റ്റാഫിനെ ചേർക്കുമ്പോൾ Unique ID-യും Date of Birth-ഉം നൽകാനും, ശമ്പള രീതി നിശ്ചയിക്കാനും, പഴയ ഷിഫ്റ്റ് നിരക്ക് സംരക്ഷിക്കാനുമുള്ള സൗകര്യം.',
            stepsMl: [
              '"Staff -> + Add Staff" വഴി സ്റ്റാഫിനെ ചേർക്കുമ്പോൾ അവരുടെ പേര്, എല്ലാവർക്കും പ്രത്യേകം Unique ID ("Auto ID" ബട്ടൺ വഴിയോ സ്വന്തമായോ നൽകാം), Date of Birth (ജനനത്തീയതി), ഫോൺ നമ്പർ എന്നിവയും ശമ്പള രീതിയും (Per Hour / Per Event / Monthly Salary) തിരഞ്ഞെടുക്കുക.',
              'പിന്നീട് ഒരു സ്റ്റാഫിന്റെ ശമ്പള നിരക്ക് മാറ്റുമ്പോൾ "Existing Event Shifts Rate Policy" തിരഞ്ഞെടുക്കാം: പഴയ ഷിഫ്റ്റുകളിൽ അന്ന് അസൈൻ ചെയ്ത നിരക്ക് തന്നെ തുടരാൻ "Keep Existing Shifts at Original Rate" ഉപയോഗിക്കാം, അല്ലെങ്കിൽ വരുന്ന ഇവന്റുകളിലെ ഷിഫ്റ്റുകൾ പുതിയ ശമ്പള നിരക്കിലേക്ക് മാറ്റാൻ "Switch to New Pricing" ഉപയോഗിക്കാം.',
              'അഡ്വാൻസ് തുകകൾ രേഖപ്പെടുത്താൻ മഞ്ഞ നിറത്തിലുള്ള "Salary Advance" ബട്ടൺ ഉപയോഗിക്കുക—ഇത് സാധാരണ ശമ്പളത്തിൽ ("Standard Salary Payout") നിന്ന് പൂർണ്ണമായും വേർതിരിച്ച് കാണിക്കുന്നു.',
              '"Payroll Report & Salary Slips" ടാബിൽ തിരഞ്ഞെടുത്ത തീയതികളിലെ ശമ്പള റിപ്പോർട്ടും A4 PDF സാലറി സ്ലിപ്പും ഡൗൺലോഡ് ചെയ്യാം.'
            ]
          },
          {
            number: '07',
            titleMl: 'ദൈനംദിന സ്റ്റോക്ക് വില മാറ്റവും ഓണറുടെ Profit & Loss കണക്കുകളും',
            menuLabel: 'Stock / Profit & Loss',
            summaryMl:
              'ഇന്നത്തെ സ്റ്റോക്ക് വില മാറ്റം നാളത്തെ ക്വട്ടേഷനുകളിൽ മാത്രം ബാധകമാകുന്നു; പഴയ ഇവന്റുകളെ ബാധിക്കില്ല.',
            stepsMl: [
              '"Stock" പേജിൽ സാധനങ്ങളുടെ വില മാറ്റുമ്പോഴോ പുതിയ വെണ്ടർ പർച്ചേസ് ബിൽ ചേർക്കുമ്പോഴോ, അപ്‌ഡേറ്റിന് ശേഷമുള്ള പുതിയ ഇവന്റുകൾക്ക് മാത്രമേ പുതിയ വില ബാധകമാകൂ. മുൻപ് നൽകിയ ഇവന്റുകളുടെ സ്റ്റോക്ക് നിരക്കും ക്വട്ടേഷനും പഴയപടി തന്നെ നിലനിൽക്കും.',
              'ഓണർക്ക് മാത്രം കാണാവുന്ന "Profit & Loss" പേജിൽ ഓരോ ഇവന്റിലെയും വരുമാനവും 4 ഇനം ചെലവുകളും സ്റ്റാഫ് ശമ്പളവും കഴിഞ്ഞ് ലഭിക്കുന്ന അറ്റാദായം (Net Profit) പരിശോധിക്കാം.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'ഫുൾ ഡാറ്റാബേസ് ബാക്കപ്പ്, റീസ്റ്റോർ & ഇംഗ്ലീഷ്/മലയാളം മാനുവലുകൾ',
        chapters: [
          {
            number: '08',
            titleMl: 'ഫുൾ ഡാറ്റാബേസ് ബാക്കപ്പ് (.json / Excel / CSV) & റീസ്റ്റോർ സംവിധാനം',
            menuLabel: 'Settings (or Dashboard) -> Full Database Backup & Restore',
            summaryMl:
              'ആപ്പിലെ മുഴുവൻ വിവരങ്ങളും ഡൗൺലോഡ് ചെയ്ത് സൂക്ഷിക്കാനും, ഡാറ്റാബേസ് റീസെറ്റ് ആയാൽ പൂർണ്ണമായി തിരികെ കയറ്റാനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Settings" പേജിലോ Owner Dashboard-ലോ ഉള്ള "Download Full Restorable Backup (.json)" അമർത്തി ക്ലൈന്റ്സ്, മെനു, സ്റ്റോക്ക്, ഇവന്റുകൾ, ലോക്ക് ചെയ്ത പഴയ വിലകൾ, സ്റ്റാഫ് ശമ്പളം, ഇൻവോയ്‌സുകൾ എന്നിവയെല്ലാം ഒറ്റ ഫയലായി ഡൗൺലോഡ് ചെയ്യുക.',
              'എന്തെങ്കിലും കാരണവശാൽ ഡാറ്റാബേസ് റീസെറ്റ് ആയാൽ, "Upload Backup (.json) File" വഴി ആ ഫയൽ അപ്‌ലോഡ് ചെയ്ത് "Confirm & Restore Full Database Now" അമർത്തിയാൽ മുഴുവൻ ഡാറ്റയും ക്ലൗഡ് ഡാറ്റാബേസിൽ അടക്കം പഴയപടി പുനഃസ്ഥാപിക്കപ്പെടും.'
            ],
            importantNoteMl:
              '15 ദിവസത്തെ ഓട്ടോമാറ്റിക് ഓർമ്മപ്പെടുത്തൽ: അവസാന ബാക്കപ്പ് എടുത്ത് 15 ദിവസം കഴിയുമ്പോൾ Owner-യുടെ Notification Bell-ലും ഡാഷ്‌ബോർഡിലും ബാക്കപ്പ് എടുക്കാനുള്ള അറിയിപ്പ് വരുന്നതാണ്.'
          },
          {
            number: '09',
            titleMl: 'ആക്ടിവിറ്റി നോട്ടിഫിക്കേഷനുകൾ, യൂസർ Unique ID നിയന്ത്രണം & മാനുവലുകൾ',
            menuLabel: 'Bell Icon / More -> Users / Settings / Manuals',
            summaryMl:
              'ടീം അംഗങ്ങൾ വരുത്തുന്ന മാറ്റങ്ങൾ ബെൽ ഐക്കണിൽ കാണാനും, എല്ലാ യൂസർമാർക്കും Unique ID & ജനനത്തീയതി ക്രമീകരിക്കാനും സാധിക്കുന്നു.',
            stepsMl: [
              'മുകളിലെ Notification Bell ഐക്കൺ ക്ലിക്ക് ചെയ്താൽ മറ്റുള്ളവർ വരുത്തിയ എഡിറ്റുകൾ ("പഴയ വിവരം -> പുതിയ വിവരം") ശല്യപ്പെടുത്തുന്ന അലേർട്ടുകൾ ഇല്ലാതെ പരിശോധിക്കാം.',
              '"More -> Users" വഴി Manager, Accountant, Staff അക്കൗണ്ടുകൾക്ക് Unique ID, Date of Birth, Phone Number എന്നിവ നൽകാം (സ്വന്തം വിവരങ്ങൾ "Settings"-ലും പുതുക്കാം); "More -> Manuals" വഴി 4 റോളുകളുടെയും യൂസർ മാനുവൽ ഇംഗ്ലീഷിലോ മലയാളത്തിലോ PDF ആയി ഡൗൺലോഡ് ചെയ്യാം.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'ക്ലൈന്റിന് ക്വട്ടേഷൻ അയക്കുന്നതിന് മുൻപ് ആ ഇവന്റിലെ സ്റ്റാഫുകളെ അസൈൻ ചെയ്താൽ കൃത്യമായ "Labour Charges" ക്വട്ടേഷനിൽ ഓട്ടോമാറ്റിക്കായി വരുന്നതാണ്.',
      'സ്റ്റോക്ക് വിലയും മെനു നിരക്കും എന്നും ധൈര്യമായി പുതുക്കാം—മുൻപ് കൊടുത്ത ക്വട്ടേഷനുകളിലോ ഇൻവോയ്‌സുകളിലോ ഒരു മാറ്റവും വരില്ല.',
      '15 ദിവസത്തിലൊരിക്കൽ ബാക്കപ്പ് ഓർമ്മപ്പെടുത്തൽ വരുമ്പോൾ തന്നെ ".json" ബാക്കപ്പ് ഫയൽ ഡൗൺലോഡ് ചെയ്ത് സുരക്ഷിതമായി സൂക്ഷിക്കുക.',
      'സ്റ്റാഫിന് അഡ്വാൻസ് നൽകുമ്പോൾ എപ്പോഴും "Salary Advance" ബട്ടൺ തന്നെ ഉപയോഗിക്കുക.'
    ]
  },

  manager: {
    key: 'manager',
    pdfFilename: 'IPPAS-Manager-User-Manual-ML.pdf',
    docCode: 'DOC-ML-MANAGER-02',
    malayalamRoleName: 'മാനേജർ (Manager)',
    englishRoleLabel: 'Manager',
    titleMl: 'മാനേജർ യൂസർ മാനുവൽ (Manager User Manual)',
    subtitleMl:
      'ക്ലൈന്റ് ബുക്കിംഗുകൾ, മെനു റെസിപ്പികൾ, ക്വട്ടേഷനിലെ നിർബന്ധിത Labour Charges, സ്റ്റോക്ക് & മെനു വില അപ്‌ഡേറ്റുകൾ, സ്റ്റാഫ് ഷിഫ്റ്റ് നിയന്ത്രണം എന്നിവയ്ക്കുള്ള മലയാളം സഹായി',
    accentColor: '#1d4ed8',
    overviewMl:
      'ദൈനംദിന കാറ്ററിംഗ് പ്രവർത്തനങ്ങൾ എളുപ്പത്തിൽ ഏകോപിപ്പിക്കുന്നതിനാണ് IPPAS Pulse-ലെ Manager വർക്ക്‌സ്‌പേസ് രൂപകൽപ്പന ചെയ്തിരിക്കുന്നത്. പുതിയ ബുക്കിംഗുകൾ ചേർക്കൽ, Top Clients പരിശോധന, സ്റ്റോക്കിൽ ഇല്ലാത്ത ചേരുവകൾ റെസിപ്പിയിൽ ചേർക്കൽ, സ്റ്റാഫ് ശമ്പളം ഓട്ടോമാറ്റിക്കായി "Labour Charges" ആയി വരുന്ന ക്വട്ടേഷനുകൾ തയ്യാറാക്കൽ, പഴയ ഇവന്റുകളെ ബാധിക്കാത്ത സ്റ്റോക്ക്/മെനു വില പുതുക്കൽ, ഷോർട്ടേജ് CSV എക്‌സ്‌പോർട്ട്, സ്റ്റാഫ് ഹാജർ രേഖപ്പെടുത്തൽ എന്നിവ ഇതിലൂടെ ചെയ്യാം.',
    accessibleModulesMl: [
      'Dashboard (വരാനിരിക്കുന്ന പരിപാടികൾ, അതിഥികളുടെ എണ്ണം, Low-Stock & Expiry അലേർട്ടുകൾ)',
      'Events (വരുന്നവയും കഴിഞ്ഞവയുമായ ബുക്കിംഗുകൾ, ക്വട്ടേഷൻ Labour Charges, WhatsApp PDF+Text)',
      'Stock (ഗോഡൗൺ സ്റ്റോക്ക്, പുതിയ ഇവന്റുകൾക്ക് മാത്രമുള്ള വില മാറ്റം, Shortage CSV & പർച്ചേസ്)',
      'Staff (3 ശമ്പള രീതികൾ, ഷിഫ്റ്റ് നിരക്ക് സംരക്ഷണം / മാറ്റം, ഹാജർ & WhatsApp ഡ്യൂട്ടി മെസ്സേജ്)',
      'More Menu -> Clients (Top Clients), Menu & Recipes & Manuals (EN / ML PDF)'
    ],
    pages: [
      {
        pageTitleMl: 'ആപ്പ് ഇൻസ്റ്റാളേഷൻ, ഡാഷ്‌ബോർഡ്, ക്ലൈന്റ്സ് & മെനു നിരക്ക് സംരക്ഷണം',
        chapters: [
          {
            number: '01',
            titleMl: 'സൈൻ-ഇൻ, 2-of-3 പാസ്‌വേഡ് റീസെറ്റ്, ആപ്പ് ഇൻസ്റ്റാളേഷൻ & ഡാഷ്‌ബോർഡ്',
            menuLabel: 'Login / Forgot Password? / Install App / Dashboard',
            summaryMl:
              'ഫോണിലോ കമ്പ്യൂട്ടറിലോ ലോഗിൻ ചെയ്യാനും, പാസ്‌വേഡ് മറന്നാൽ 3 ഓപ്ഷനുകളിൽ ഏതെങ്കിലും 2 എണ്ണം നൽകി റീസെറ്റ് ചെയ്യാനും സാധിക്കുന്നു.',
            stepsMl: [
              'Owner നൽകിയ Manager യൂസർനെയിമും (അല്ലെങ്കിൽ Unique ID-യും) പാസ്‌വേഡും ഉപയോഗിച്ച് "Sign In" ചെയ്യുക. പാസ്‌വേഡ് മറന്നാൽ "Forgot Password?" ക്ലിക്ക് ചെയ്ത് Unique ID, Phone Number, Date of Birth എന്നിവയിൽ ഏതെങ്കിലും രണ്ട് (2) ഓപ്ഷനുകൾ തിരഞ്ഞെടുത്ത് പുതിയ പാസ്‌വേഡ് സെറ്റ് ചെയ്യാം.',
              '"Install App" ബട്ടൺ അമർത്തിയാൽ ഫോണിലെ മറ്റ് ആപ്പുകൾക്കൊപ്പവും ഹോം സ്ക്രീനിലും IPPAS Pulse ഐക്കൺ ഉടൻ ചേർക്കപ്പെടും (iPhone Safari-യിൽ Share -> "Add to Home Screen" ഉപയോഗിക്കുക).',
              'Dashboard-ൽ വരാനിരിക്കുന്ന ബുക്കിംഗുകൾ, ആകെ അതിഥികളുടെ എണ്ണം, സ്റ്റോക്ക് കുറവുള്ള സാധനങ്ങൾ, കാലാവധി കഴിയാറായ (Expiry) സാധനങ്ങൾ എന്നിവ കാണാം.'
            ]
          },
          {
            number: '02',
            titleMl: 'Top Clients ലിസ്റ്റ്, മെനു റെസിപ്പികൾ & പഴയ മെനു നിരക്ക് സംരക്ഷണം',
            menuLabel: 'More -> Clients / Menu & Recipes',
            summaryMl:
              'മികച്ച ക്ലൈന്റ്സിനെ തിരിച്ചറിയാനും, സ്റ്റോക്കിൽ ഇല്ലാത്ത ചേരുവകൾ ചേർക്കാനും, സുരക്ഷിതമായി മെനു വില പുതുക്കാനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Clients" പേജിൽ പുതിയ കസ്റ്റമർ വിവരങ്ങൾ ചേർക്കുകയും, ഏറ്റവും കൂടുതൽ തുക നൽകിയവരെയും കൂടുതൽ പരിപാടികൾ നടത്തിയവരെയും "Top Clients Leaderboard"-ൽ കാണുകയും ചെയ്യാം.',
              '"Menu & Recipes"-ൽ വിഭവങ്ങൾ ചേർത്ത് "Edit Recipe" ക്ലിക്ക് ചെയ്യുക. ആവശ്യമായ ചേരുവ സ്റ്റോക്കിൽ ഇല്ലെങ്കിൽ "+ Create New Ingredient (Not in Stock)" വഴി അവിടെത്തന്നെ പുതിയ ചേരുവ ഉണ്ടാക്കി ചേർക്കാം.',
              'മെനു ഐറ്റത്തിന്റെ വില മാറ്റുമ്പോൾ (ഉദാ: ₹100-ൽ നിന്ന് ₹120 ആക്കുമ്പോൾ), പുതിയ ക്വട്ടേഷനുകളിൽ മാത്രമേ പുതിയ വില വരൂ—മുൻപ് കൊടുത്ത ഇവന്റുകളിലെ ക്വട്ടേഷനുകളിലും ബില്ലുകളിലും പഴയ വില തന്നെ തുടരും.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'കാറ്ററിംഗ് ബുക്കിംഗുകൾ, നിർബന്ധിത Labour Charges & സ്റ്റോക്ക് നിയന്ത്രണം',
        chapters: [
          {
            number: '03',
            titleMl: 'ബുക്കിംഗുകൾ, ക്വട്ടേഷനിലെ "Labour Charges", പ്രിന്റ് & WhatsApp ഷെയറിംഗ്',
            menuLabel: 'Events -> Event Detail',
            summaryMl:
              'നിയോഗിച്ച സ്റ്റാഫുകളുടെ ആകെ ശമ്പളം "Labour Charges" ആയി ക്വട്ടേഷനിൽ ഓട്ടോമാറ്റിക്കായി ചേർത്ത് ക്ലൈന്റിന് അയക്കാം.',
            stepsMl: [
              '"Events" പേജിൽ "Upcoming Bookings", "Previous / Completed Events" എന്നിവ വെവ്വേറെ പരിശോധിച്ച് "+ New Booking" വഴി പുതിയ ഇവന്റ് ചേർക്കുക.',
              'ഇവന്റിലെ "Staff Shifts" വിഭാഗത്തിൽ സ്റ്റാഫുകളെ ചേർക്കുമ്പോൾ, അവരുടെ ആകെ ശമ്പള തുക കണക്കാക്കി "Labour Charges" എന്ന ഇനം എല്ലാ ക്വട്ടേഷനിലും ഓട്ടോമാറ്റിക്കായി ഉൾപ്പെടുന്നു.',
              '"Print Proposal" അമർത്തിയാൽ വെബ് പേജ് ഭാഗങ്ങളില്ലാതെ A4 ക്വട്ടേഷൻ മാത്രം പ്രിന്റ് ചെയ്യാം; "Send on WhatsApp" വഴി ഫോണിൽ PDF ഫയലും സന്ദേശവും ഒരുമിച്ച് അയക്കാം.'
            ]
          },
          {
            number: '04',
            titleMl: 'ഗോഡൗൺ സ്റ്റോക്ക്, പുതിയ ഇവന്റുകൾക്ക് മാത്രമുള്ള വില മാറ്റം & Shortage CSV',
            menuLabel: 'Stock / Event Sufficiency',
            summaryMl:
              'പഴയ ഇവന്റുകളെ ബാധിക്കാതെ ഇന്നത്തെ സ്റ്റോക്ക് വില പുതുക്കാനും, വെണ്ടർ ഓർഡറിനായി Shortage CSV എടുക്കാനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Stock" പേജിൽ സാധനങ്ങൾ ചേർക്കാനും, Expiry തീയതി രേഖപ്പെടുത്താനും, "Vendor Stock Purchases" അല്ലെങ്കിൽ "Bulk Stock Update" ചെയ്യാനും സാധിക്കും.',
              'സ്റ്റോക്ക് വിലയിൽ വരുത്തുന്ന മാറ്റങ്ങൾ അപ്‌ഡേറ്റിന് ശേഷമുള്ള പുതിയ ഇവന്റുകൾക്ക് മാത്രമേ ബാധകമാകൂ; പഴയ ഇവന്റുകളിലെ നിരക്കുകൾ സുരക്ഷിതമായി നിലനിൽക്കും.',
              '"Export Inventory & Shortage CSV" ബട്ടൺ വഴി നിലവിലെ സ്റ്റോക്കും കുറവുള്ള അളവും CSV ഫയലായി ഡൗൺലോഡ് ചെയ്ത് വെണ്ടർമാർക്ക് ഓർഡർ നൽകാം.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'സ്റ്റാഫ് ശമ്പള രീതികൾ, ഷിഫ്റ്റ് നിരക്ക് മാറ്റം, ഹാജർ & ഇവന്റ് ചെലവുകൾ',
        chapters: [
          {
            number: '05',
            titleMl: 'സ്റ്റാഫ് Unique ID & ജനനത്തീയതി (DOB), ശമ്പള പ്ലാനുകൾ & ഹാജർ',
            menuLabel: 'Staff -> + Add Staff / Event -> Crew Shifts',
            summaryMl:
              'സ്റ്റാഫിനെ ചേർക്കുമ്പോൾ Unique ID-യും Date of Birth-ഉം നൽകാനും, ശമ്പള രീതി നിശ്ചയിക്കാനും, ഹാജർ രേഖപ്പെടുത്താനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Staff -> + Add Staff"-ൽ സ്റ്റാഫിന്റെ പേര്, Unique ID ("Auto ID" വഴിയോ സ്വന്തമായോ), Date of Birth (ജനനത്തീയതി), ഫോൺ നമ്പർ എന്നിവ നൽകി Per Hour (മണിക്കൂർ), Per Event (ഇവന്റ് ഒന്നിന്), അല്ലെങ്കിൽ Monthly (മാസ ശമ്പളം) എന്നീ രീതികളിൽ ഒന്ന് തിരഞ്ഞെടുക്കുക.',
              'ഓരോ ഇവന്റ് ഷിഫ്റ്റിലും അന്ന് അസൈൻ ചെയ്ത ശമ്പള നിരക്ക് ലോക്ക് ചെയ്യപ്പെടുന്നു. പിന്നീട് സ്റ്റാഫിന്റെ ശമ്പളം കൂട്ടിയാലും പഴയ ഷിഫ്റ്റുകൾ പഴയ നിരക്കിൽ തന്നെ നിൽക്കും—ആവശ്യമെങ്കിൽ വരുന്ന ഇവന്റുകളിലെ ഷിഫ്റ്റുകൾ മാത്രം "Switch to New Pricing" വഴി പുതിയ നിരക്കിലേക്ക് മാറ്റാം.',
              'പരിപാടി കഴിഞ്ഞാലുടൻ സ്റ്റാഫ് ഹാജർ ("Present" / "Absent") രേഖപ്പെടുത്തുക. സ്റ്റാഫ് പാസ്‌വേഡ് മറന്നാൽ ലോഗിൻ സ്ക്രീനിലെ "Forgot Password?" വഴി Unique ID, Phone Number, Date of Birth എന്നിവയിൽ ഏതെങ്കിലും രണ്ട് (2) വിവരങ്ങൾ നൽകി അവർക്ക് സ്വയം പാസ്‌വേഡ് റീസെറ്റ് ചെയ്യാം.'
            ],
            importantNoteMl:
              '"Present" എന്ന് രേഖപ്പെടുത്തുന്ന ഷിഫ്റ്റുകൾ മാത്രമേ മണിക്കൂർ/ഇവന്റ് ശമ്പള കണക്കിൽ ഉൾപ്പെടുകയുള്ളൂ.'
          }
        ]
      }
    ],
    bestPracticesMl: [
      'ക്വട്ടേഷൻ തയ്യാറാക്കുമ്പോൾ തന്നെ സ്റ്റാഫുകളെ അസൈൻ ചെയ്താൽ കൃത്യമായ "Labour Charges" ക്വട്ടേഷനിൽ ഓട്ടോമാറ്റിക്കായി വരുന്നതാണ്.',
      'പരിപാടിക്ക് 48 മണിക്കൂർ മുൻപ് Stock Sufficiency പരിശോധിച്ച് Shortage CSV ഡൗൺലോഡ് ചെയ്ത് സാധനങ്ങൾ ഓർഡർ ചെയ്യുക.',
      'ഓരോ പരിപാടി കഴിഞ്ഞ ഉടൻ തന്നെ സ്റ്റാഫുകളുടെ ഹാജർ ("Present" / "Absent") കൃത്യമായി രേഖപ്പെടുത്തുക.'
    ]
  },

  accountant: {
    key: 'accountant',
    pdfFilename: 'IPPAS-Accountant-User-Manual-ML.pdf',
    docCode: 'DOC-ML-ACCOUNTANT-02',
    malayalamRoleName: 'അക്കൗണ്ടന്റ് (Accountant)',
    englishRoleLabel: 'Accountant',
    titleMl: 'അക്കൗണ്ടന്റ് യൂസർ മാനുവൽ (Accountant User Manual)',
    subtitleMl:
      'മാറ്റം വരാത്ത ഇൻവോയ്‌സ് ബില്ലിംഗ്, ക്വട്ടേഷൻ Labour Charges, ബാങ്ക്/ക്യാഷ് കണക്കുകൾ, വേർതിരിച്ച Salary Advance, A4 സാലറി സ്ലിപ്പുകൾ എന്നിവയ്ക്കുള്ള മലയാളം സഹായി',
    accentColor: '#047857',
    overviewMl:
      'കാറ്ററിംഗ് സ്ഥാപനത്തിന്റെ എല്ലാ വരവ്-ചെലവ് കണക്കുകളും സ്റ്റാഫ് ശമ്പള വിതരണവും കൃത്യമായി കൈകാര്യം ചെയ്യുന്നതിനുള്ള വിഭാഗമാണ് Accountant വർക്ക്‌സ്‌പേസ്. പഴയ നിരക്കുകൾക്ക് മാറ്റം വരാത്ത ഇൻവോയ്‌സുകൾ, ക്വട്ടേഷനിലെ നിർബന്ധിത Labour Charges പരിശോധന, ബാങ്ക്/UPI vs ക്യാഷ് കളക്ഷൻ കണക്കുകൾ, Top Clients ലിസ്റ്റ്, വെണ്ടർ ബിൽ പേയ്‌മെന്റുകൾ, സാധാരണ ശമ്പളത്തിൽ നിന്ന് വേർതിരിച്ച Salary Advance, A4 സാലറി സ്ലിപ്പ് PDF എന്നിവ ഇതിലൂടെ കൈകാര്യം ചെയ്യാം.',
    accessibleModulesMl: [
      'Dashboard (ധനകാര്യ അവലോകനം, കിട്ടാനുള്ള തുക, കൊടുക്കാനുള്ള തുക & ബാങ്ക്/ക്യാഷ് ബാലൻസ്)',
      'Invoices (ലോക്ക് ചെയ്ത ബില്ലുകൾ, ഡിസ്കൗണ്ട്, പാർട്ട് പേയ്‌മെന്റ്, Final Settlement & WhatsApp)',
      'Events (Labour Charges ഉൾപ്പെട്ട ക്വട്ടേഷൻ തുകയും 4 ഇനം ഇവന്റ് ചെലവ് കണക്കുകളും)',
      'Staff (ലോക്ക് ചെയ്ത ഷിഫ്റ്റ് നിരക്കുകൾ, Salary Advance ബട്ടൺ & A4 സാലറി സ്ലിപ്പ് PDF)',
      'Stock (വെണ്ടർ പർച്ചേസ് ബില്ലുകളും സപ്ലയർ പേയ്‌മെന്റുകളും)',
      'More Menu -> Clients (Top Clients Leaderboard) & Manuals (EN / ML PDF)'
    ],
    pages: [
      {
        pageTitleMl: 'ഫിനാൻഷ്യൽ ഡാഷ്‌ബോർഡ്, ബാങ്ക്/ക്യാഷ് കണക്കുകൾ & ഇൻവോയ്‌സ് ബില്ലിംഗ്',
        chapters: [
          {
            number: '01',
            titleMl: 'സൈൻ-ഇൻ, 2-of-3 പാസ്‌വേഡ് റീസെറ്റ്, ബാങ്ക്/ക്യാഷ് ബാലൻസ് & Top Clients',
            menuLabel: 'Login / Forgot Password? / Dashboard / More -> Clients',
            summaryMl:
              'സുരക്ഷിതമായി ലോഗിൻ ചെയ്യാനും, പാസ്‌വേഡ് മറന്നാൽ 3-ൽ ഏതെങ്കിലും 2 വിവരങ്ങൾ നൽകി റീസെറ്റ് ചെയ്യാനും, ബാങ്ക്/ക്യാഷ് തുക പരിശോധിക്കാനും സാധിക്കുന്നു.',
            stepsMl: [
              'Accountant യൂസർനെയിമും (അല്ലെങ്കിൽ Unique ID-യും) പാസ്‌വേഡും നൽകി ലോഗിൻ ചെയ്യുക. പാസ്‌വേഡ് മറന്നാൽ ലോഗിൻ സ്ക്രീനിലെ "Forgot Password?" ക്ലിക്ക് ചെയ്ത് Unique ID, Phone Number, Date of Birth എന്നിവയിൽ ഏതെങ്കിലും രണ്ട് (2) ഓപ്ഷനുകൾ തിരഞ്ഞെടുത്ത് പുതിയ പാസ്‌വേഡ് സെറ്റ് ചെയ്യാം.',
              'Dashboard-ലെ "Account-wise Invoice Collections" വഴി ഓരോ ബാങ്ക്/UPI അക്കൗണ്ടിലും ഓഫീസ് ക്യാഷിലും ലഭിച്ച തുക കൃത്യമായി ഒത്തുനോക്കാം.',
              '"More -> Clients" തുറന്ന് "Top Clients Leaderboard"-ൽ ഏറ്റവും കൂടുതൽ തുക നൽകിയ ക്ലൈന്റ്സിനെയും ബാക്കി കിട്ടാനുള്ള തുകയും പരിശോധിക്കാം.'
            ]
          },
          {
            number: '02',
            titleMl: 'മാറ്റം വരാത്ത ക്വട്ടേഷൻ/ഇൻവോയ്‌സ് നിരക്കുകളും "Labour Charges"-ഉം',
            menuLabel: 'Events / Invoices',
            summaryMl:
              'ക്വട്ടേഷനിലെ നിർബന്ധിത Labour Charges ഉറപ്പുവരുത്തി, പിന്നീട് വില മാറിയാലും മാറ്റം വരാത്ത ഇൻവോയ്‌സുകൾ തയ്യാറാക്കാം.',
            stepsMl: [
              'ഓരോ ഇവന്റിന്റെയും ക്വട്ടേഷനിൽ ആ ഇവന്റിലേക്ക് നിയോഗിച്ച സ്റ്റാഫുകളുടെ ആകെ ശമ്പളം "Labour Charges" എന്ന പേരിൽ നിർബന്ധമായും ഉൾപ്പെട്ടിരിക്കും.',
              'ക്വട്ടേഷൻ "Approve Quote & Convert to Invoice" വഴി ഇൻവോയ്‌സ് ആക്കുമ്പോൾ അതിലെ വിഭവങ്ങളുടെ നിരക്കുകളും Labour Charges-ഉം സ്ഥിരമായി ലോക്ക് ആകുന്നു—പിന്നീട് സ്റ്റോക്ക്/മെനു/സ്റ്റാഫ് വിലകൾ മാറിയാലും പഴയ ബില്ലുകളിൽ ഒരു മാറ്റവും വരില്ല.',
              '"Record Payment" വഴി ബാങ്ക്/UPI അക്കൗണ്ടോ ക്യാഷോ തിരഞ്ഞെടുത്ത് പേയ്‌മെന്റുകൾ രേഖപ്പെടുത്താം; മുഴുവൻ തുകയും ലഭിക്കുമ്പോൾ ബിൽ "Final Settlement Invoice" ആയി മാറും.',
              '"Print" വഴി A4 ബിൽ മാത്രമായി പ്രിന്റ് എടുക്കാം; "Send on WhatsApp" വഴി PDF-ഉം സന്ദേശവും ഒരുമിച്ച് ക്ലൈന്റിന് അയക്കാം.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'സ്റ്റാഫ് ശമ്പള നിരക്ക് സംരക്ഷണം, Salary Advance & സാലറി സ്ലിപ്പ് PDF',
        chapters: [
          {
            number: '03',
            titleMl: 'പഴയ ഷിഫ്റ്റ് നിരക്ക് സംരക്ഷണവും "Salary Advance" ബട്ടണും',
            menuLabel: 'Staff -> Crew & Shifts',
            summaryMl:
              'അസൈൻ ചെയ്ത സമയത്തെ ശമ്പള നിരക്ക് നിലനിർത്താനും, അഡ്വാൻസ് തുക സാധാരണ ശമ്പളത്തിൽ നിന്ന് വേർതിരിച്ച് രേഖപ്പെടുത്താനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Staff" പേജിൽ ഓരോ ജീവനക്കാരന്റെയും ശമ്പള രീതിയും (Per Hour / Per Event / Monthly) ഓരോ ഷിഫ്റ്റിലെയും ലോക്ക് ചെയ്ത നിരക്കും കാണാം.',
              'ഒരു സ്റ്റാഫിന്റെ ശമ്പളം പിന്നീട് വർദ്ധിപ്പിച്ചാലും മുൻപുള്ള ഷിഫ്റ്റുകൾ പഴയ നിരക്കിൽ തന്നെ കണക്കാക്കപ്പെടും (പുതിയ നിരക്കിലേക്ക് മാറ്റണമെങ്കിൽ മാത്രം "Switch to New Pricing" ഓപ്ഷൻ ഉപയോഗിക്കാം).',
              'മാസത്തിനിടയിൽ അഡ്വാൻസ് നൽകുമ്പോൾ മഞ്ഞ നിറത്തിലുള്ള "Salary Advance" ബട്ടണും, സാധാരണ ശമ്പളം നൽകുമ്പോൾ "Pay Salary" ബട്ടണും ഉപയോഗിക്കുക—ഇവ രണ്ടും എല്ലാ കണക്കുകളിലും സാലറി സ്ലിപ്പിലും വെവ്വേറെ തന്നെ കാണിക്കും.'
            ],
            importantNoteMl:
              'അഡ്വാൻസ് തുക ഒരിക്കലും സാധാരണ "Pay Salary"-യിൽ ചേർക്കാതെ "Salary Advance" ബട്ടൺ തന്നെ ഉപയോഗിക്കുക.'
          },
          {
            number: '04',
            titleMl: 'തീയതി തിരഞ്ഞെടുത്തുള്ള പേറോൾ റിപ്പോർട്ടും A4 സാലറി സ്ലിപ്പ് PDF-ഉം',
            menuLabel: 'Staff -> Payroll Report & Salary Slips',
            summaryMl:
              'നിശ്ചിത കാലയളവിലെ ആകെ മണിക്കൂറുകൾ, ശമ്പളം, അഡ്വാൻസ്, ബാക്കി തുക എന്നിവ അടങ്ങിയ PDF സാലറി സ്ലിപ്പ് എടുക്കാം.',
            stepsMl: [
              '"Payroll Report & Salary Slips" ടാബിൽ Start Date, End Date എന്നിവ തിരഞ്ഞെടുക്കുക.',
              'ഓരോ സ്റ്റാഫും ജോലി ചെയ്ത മണിക്കൂറുകൾ/ഷിഫ്റ്റുകൾ, ലോക്ക് ചെയ്ത നിരക്കിലുള്ള വരുമാനം, അലവൻസുകൾ, Standard Salary Paid, Salary Advances Taken, ബാക്കി നൽകാനുള്ള തുക എന്നിവ പരിശോധിക്കുക.',
              '"Slip PDF", "Print", അല്ലെങ്കിൽ "WhatsApp" ക്ലിക്ക് ചെയ്ത് A4 സാലറി സ്ലിപ്പ് ഡൗൺലോഡ് ചെയ്യുകയോ സ്റ്റാഫിന് അയക്കുകയോ ചെയ്യാം.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'വെണ്ടർ പർച്ചേസ് ബില്ലുകളും ഇവന്റ് ചെലവ് കണക്കുകളും',
        chapters: [
          {
            number: '05',
            titleMl: 'സപ്ലയർ ബിൽ പേയ്‌മെന്റുകളും 4 ഇനം ഇവന്റ് ചെലവുകളും',
            menuLabel: 'Stock -> Vendor Purchases / Events -> Expenses',
            summaryMl:
              'പഴയ ഇവന്റുകളെ ബാധിക്കാതെ പുതിയ വെണ്ടർ ബില്ലുകൾ ചേർക്കാനും ഇവന്റ് ചെലവുകൾ രേഖപ്പെടുത്താനും സാധിക്കുന്നു.',
            stepsMl: [
              '"Stock -> Vendor Purchases"-ൽ പുതിയ മാർക്കറ്റ് വിലയിലുള്ള പർച്ചേസ് ബില്ലുകളും സപ്ലയർ പേയ്‌മെന്റുകളും രേഖപ്പെടുത്താം—മുൻപുള്ള ഇവന്റുകളിലെ സ്റ്റോക്ക് നിരക്കുകൾക്ക് മാറ്റം വരില്ല.',
              '"Events -> Expenses"-ൽ Stock Pricing, Extras Taken Cost, Staff Extra Expenses, Other Expenses എന്നീ 4 ഇനം ചെലവുകൾ രേഖപ്പെടുത്തി A4 Expense Sheet പ്രിന്റ് എടുക്കാം.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'ക്ലൈന്റ് പേയ്‌മെന്റ് രേഖപ്പെടുത്തുമ്പോൾ പണം എത്തിയത് ഏത് ബാങ്ക് അക്കൗണ്ടിലാണോ അതോ ക്യാഷ് ആയാണോ എന്ന് കൃത്യമായി തിരഞ്ഞെടുക്കുക.',
      'മാസാവസാനം "Payroll Report & Salary Slips" വഴി എല്ലാ സ്റ്റാഫുകളുടെയും A4 സാലറി സ്ലിപ്പ് PDF സൂക്ഷിച്ചു വെക്കുക.',
      'വെണ്ടർ ബില്ലുകളിലെ ബാക്കി തുക ആഴ്ചതോറും പരിശോധിച്ച് തീർപ്പാക്കുക.'
    ]
  },

  staff: {
    key: 'staff',
    pdfFilename: 'IPPAS-Staff-User-Manual-ML.pdf',
    docCode: 'DOC-ML-STAFF-02',
    malayalamRoleName: 'സ്റ്റാഫ് (Staff)',
    englishRoleLabel: 'Staff',
    titleMl: 'സ്റ്റാഫ് യൂസർ മാനുവൽ (Staff User Manual)',
    subtitleMl:
      'മൊബൈൽ നമ്പർ ഉപയോഗിച്ചുള്ള ലോഗിൻ, പാസ്‌വേഡ് റീസെറ്റ്, ആപ്പ് ഇൻസ്റ്റാളേഷൻ, വരുന്നവയും പങ്കെടുത്തവയുമായ ഇവന്റുകൾ, ഷിഫ്റ്റ് നിരക്ക്, ശമ്പളം & അഡ്വാൻസ് വിവരങ്ങൾ എന്നിവയ്ക്കുള്ള മലയാളം സഹായി',
    accentColor: '#6d28d9',
    overviewMl:
      'കാറ്ററിംഗ് സ്റ്റാഫ് അംഗങ്ങൾക്ക് തങ്ങളുടെ വരാനിരിക്കുന്ന ഡ്യൂട്ടികൾ, പരിപാടി നടക്കുന്ന സ്ഥലത്തിന്റെ Google Maps ലൊക്കേഷൻ, ഇതുവരെ പങ്കെടുത്ത പരിപാടികൾ, ഓരോ ഇവന്റിലും നിശ്ചയിച്ചിട്ടുള്ള ശമ്പള നിരക്ക് (Assigned Rate), കൈപ്പറ്റിയ സാധാരണ ശമ്പളം, വാങ്ങിയ അഡ്വാൻസ് തുക (Salary Advance), ഇനി കിട്ടാനുള്ള ബാക്കി ശമ്പളം എന്നിവ ഫോണിലൂടെ വളരെ ലളിതമായി കാണാനുള്ള സംവിധാനമാണ് IPPAS Pulse Staff Portal.',
    accessibleModulesMl: [
      'My Portal (വരാനിരിക്കുന്ന ഇവന്റുകൾ, പങ്കെടുത്ത ഇവന്റുകൾ, ഷിഫ്റ്റ് നിരക്ക് & ശമ്പള/അഡ്വാൻസ് കണക്ക്)',
      'Manuals (ഇംഗ്ലീഷിലും മലയാളത്തിലും ഡൗൺലോഡ് ചെയ്യാവുന്ന സ്റ്റാഫ് യൂസർ മാനുവൽ PDF)',
      'Profile / Menu -> Change Password & Logout'
    ],
    pages: [
      {
        pageTitleMl: 'മൊബൈൽ ലോഗിൻ, പാസ്‌വേഡ് റീസെറ്റ് & ഫോൺ ആപ്പ് ഇൻസ്റ്റാളേഷൻ',
        chapters: [
          {
            number: '01',
            titleMl: 'സൈൻ-ഇൻ & പാസ്‌വേഡ് മറന്നാൽ 2-of-3 വെരിഫിക്കേഷൻ വഴി റീസെറ്റ് ചെയ്യൽ',
            menuLabel: 'Sign In / Forgot Password? (Select Any 2 of 3)',
            summaryMl:
              'നിങ്ങളുടെ മൊബൈൽ നമ്പറോ Unique ID-യോ ഉപയോഗിച്ച് ലോഗിൻ ചെയ്യാനും, പാസ്‌വേഡ് മറന്നാൽ 3 ഓപ്ഷനുകളിൽ ഏതെങ്കിലും 2 എണ്ണം തിരഞ്ഞെടുത്ത് റീസെറ്റ് ചെയ്യാനുമുള്ള സൗകര്യം.',
            stepsMl: [
              'ഫോണിൽ IPPAS Pulse തുറന്ന് നിങ്ങളുടെ രജിസ്റ്റർ ചെയ്ത 10 അക്ക മൊബൈൽ നമ്പറോ അല്ലെങ്കിൽ നിങ്ങൾക്ക് നൽകിയ Staff Unique ID-യോ (ഉദാ: STF-001) നൽകുക.',
              'പാസ്‌വേഡ് നൽകി "Sign In" അമർത്തിയാൽ നിങ്ങളുടെ വ്യക്തിഗത Staff Portal തുറന്നുവരും; പോർട്ടലിന് മുകളിൽ നിങ്ങളുടെ Unique ID, ഫോൺ നമ്പർ, ജനനത്തീയതി (DOB) എന്നിവ കാണാം.',
              'പാസ്‌വേഡ് മറന്നുപോയാൽ ലോഗിൻ സ്ക്രീനിലെ "Forgot Password?" അമർത്തുക. തുടർന്ന് (1) Unique ID, (2) Phone Number, (3) Date of Birth (ജനനത്തീയതി) എന്നിവയിൽ ഏതെങ്കിലും രണ്ട് (2) ഓപ്ഷനുകൾ തിരഞ്ഞെടുത്ത് അവയുടെ ശരിയായ വിവരങ്ങൾ നൽകിയാൽ മാത്രമേ പുതിയ പാസ്‌വേഡ് സെറ്റ് ചെയ്യാൻ സാധിക്കുകയുള്ളൂ.'
            ],
            importantNoteMl:
              'പാസ്‌വേഡ് റീസെറ്റ് ചെയ്യാൻ മുകളിൽ പറഞ്ഞ മൂന്ന് വിവരങ്ങളിൽ (Unique ID, Phone Number, Date of Birth) ഏതെങ്കിലും രണ്ട് (2) എണ്ണം കൃത്യമായി നൽകേണ്ടതാണ്. ആപ്പ് തുറക്കുമ്പോൾ ഫോണിൽ ഇന്റർനെറ്റ് (Mobile Data / Wi-Fi) ഓൺ ആയിരിക്കണം.'
          },
          {
            number: '02',
            titleMl: 'സ്മാർട്ട്‌ഫോണിൽ ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുന്ന വിധം (പെർമിഷനുകൾ ആവശ്യമില്ല)',
            menuLabel: 'Install App Banner / Button',
            summaryMl:
              'മറ്റ് ആപ്പുകളുടെ കൂടെയും ഹോം സ്ക്രീനിലും IPPAS Pulse ഐക്കൺ ഒറ്റ ടാപ്പിൽ ചേർക്കാം.',
            stepsMl: [
              'ലോഗിൻ പേജിലോ പോർട്ടലിന് മുകളിലോ കാണുന്ന "Install App" ബട്ടൺ അമർത്തുക.',
              'ആൻഡ്രോയിഡ് ഫോണുകളിൽ "Install" കൊടുത്താൽ മറ്റ് ആപ്പുകളുടെ കൂടെയും ഹോം സ്ക്രീനിലും ആപ്പ് ഐക്കൺ ഓട്ടോമാറ്റിക്കായി വരുന്നതാണ്—വേറെ പെർമിഷനുകൾ ഒന്നും നൽകേണ്ടതില്ല.',
              'iPhone (Safari) ഉപയോഗിക്കുന്നവർ താഴെയുള്ള "Share" അമർത്തി "Add to Home Screen" തിരഞ്ഞെടുക്കുക.'
            ]
          }
        ]
      },
      {
        pageTitleMl: 'വരാനിരിക്കുന്ന ഇവന്റുകൾ, പങ്കെടുത്തവ, ഷിഫ്റ്റ് നിരക്ക് & ശമ്പള വിവരങ്ങൾ',
        chapters: [
          {
            number: '03',
            titleMl: 'വരാനിരിക്കുന്ന പരിപാടികളും പങ്കെടുത്ത പരിപാടികളും ഷിഫ്റ്റ് നിരക്കും',
            menuLabel: 'My Portal -> Upcoming Events / Attended Events',
            summaryMl:
              'അടുത്ത ഡ്യൂട്ടി സമയവും സ്ഥലവും, ഓരോ പരിപാടിക്കും നിശ്ചയിച്ച ശമ്പള നിരക്കും വെവ്വേറെ കാണാം.',
            stepsMl: [
              '"Upcoming Events" വിഭാഗത്തിൽ നിങ്ങളുടെ അടുത്ത പരിപാടിയുടെ തീയതി, എത്തേണ്ട സമയം, നിശ്ചയിച്ച ശമ്പള നിരക്ക് ("Assigned Rate"), ഡ്യൂട്ടി നിർദ്ദേശങ്ങൾ എന്നിവ കാണാം; "Open Venue in Google Maps" അമർത്തിയാൽ സ്ഥലത്തേക്കുള്ള വഴി ലഭിക്കും.',
              '"Events Attended So Far" വിഭാഗത്തിൽ നിങ്ങൾ ഇതുവരെ പങ്കെടുത്ത എല്ലാ പരിപാടികളും, ജോലി ചെയ്ത മണിക്കൂറുകളും, ആ ഇവന്റിലെ ലോക്ക് ചെയ്ത നിരക്കും, ഹാജർ നിലയും ("Attended"), ആ ഷിഫ്റ്റിൽ ലഭിച്ച തുകയും കാണാം.',
              'ഭാവിയിൽ നിങ്ങളുടെ ശമ്പള നിരക്കിൽ മാറ്റം വന്നാലും മുൻപ് പങ്കെടുത്ത പരിപാടികളുടെ കണക്ക് അന്നത്തെ നിരക്കിൽ തന്നെ സുരക്ഷിതമായി നിലനിൽക്കുകയും, പുതിയ ഡ്യൂട്ടികളിൽ പുതിയ നിരക്ക് വരികയും ചെയ്യും.'
            ]
          },
          {
            number: '04',
            titleMl: 'ശമ്പള രീതി, കൈപ്പറ്റിയ ശമ്പളം & Salary Advance വിവരങ്ങൾ',
            menuLabel: 'My Portal -> Salary KPIs & Payouts Table',
            summaryMl:
              'ആകെ ശമ്പളം, സാധാരണ ശമ്പളമായി കിട്ടിയ തുക, വാങ്ങിയ അഡ്വാൻസ്, ഇനി കിട്ടാനുള്ള ബാക്കി എന്നിവ വ്യക്തമായി അറിയാം.',
            stepsMl: [
              'നിങ്ങളുടെ ശമ്പള രീതി—Per Hour (മണിക്കൂർ നിരക്ക്), Per Event (ഇവന്റ് നിരക്ക്), അല്ലെങ്കിൽ Monthly Fixed Salary (മാസ ശമ്പളം)—പോർട്ടലിന് മുകളിൽ കാണാം.',
              '4 കാർഡുകളിലായി: (1) Total Salary Earned (ആകെ ശമ്പളം + ബോണസ്), (2) Standard Salary Paid (കൈപ്പറ്റിയ ശമ്പളം), (3) Salary Advances Taken (വാങ്ങിയ അഡ്വാൻസ് തുക വേർതിരിച്ച്), (4) Pending Balance Payable (ഇനി കിട്ടാനുള്ള ബാക്കി തുക) എന്നിവ കാണാം.',
              '"Salary Payouts & Advances Received" പട്ടികയിൽ നിങ്ങൾക്ക് ലഭിച്ച ഓരോ തുകയും അത് സാധാരണ ശമ്പളമാണോ അതോ "Salary Advance" ആണോ എന്നും തീയതി സഹിതം പരിശോധിക്കാം.'
            ]
          },
          {
            number: '05',
            titleMl: 'പാസ്‌വേഡ് മാറ്റൽ, ഇംഗ്ലീഷ്/മലയാളം PDF മാനുവൽ ഡൗൺലോഡ് & ലോഗൗട്ട്',
            menuLabel: 'Change Password / Manuals / Logout',
            summaryMl:
              'നിങ്ങളുടെ അക്കൗണ്ട് സുരക്ഷിതമാക്കാനും യൂസർ മാനുവൽ ഫോണിൽ സൂക്ഷിക്കാനുമുള്ള വിധം.',
            stepsMl: [
              'ആദ്യ ലോഗിന് ശേഷം മുകളിലുള്ള "Change Password" അമർത്തി നിങ്ങൾക്ക് മാത്രം അറിയാവുന്ന പുതിയ പാസ്‌വേഡ് നൽകുക.',
              '"Staff User Manual (PDF)" ക്ലിക്ക് ചെയ്ത് ഈ യൂസർ മാനുവൽ ഇംഗ്ലീഷിലോ മലയാളത്തിലോ നിങ്ങളുടെ ഫോണിലേക്ക് PDF ആയി ഡൗൺലോഡ് ചെയ്യാം.',
              'മറ്റുള്ളവരുടെ ഫോണിലോ ഓഫീസ് കമ്പ്യൂട്ടറിലോ ലോഗിൻ ചെയ്താൽ ഉപയോഗശേഷം നിർബന്ധമായും "Logout" അമർത്തുക.'
            ]
          }
        ]
      }
    ],
    bestPracticesMl: [
      'ഓരോ പരിപാടിയുടെയും തലേദിവസം ആപ്പ് തുറന്ന് എത്തേണ്ട സമയവും "Assigned Rate"-ഉം Google Maps ലൊക്കേഷനും പരിശോധിക്കുക.',
      'പരിപാടി കഴിഞ്ഞ ശേഷം നിങ്ങളുടെ ഹാജർ "Attended" എന്ന് രേഖപ്പെടുത്തിയിട്ടുണ്ടെന്ന് ഉറപ്പുവരുത്തുക.',
      'നിങ്ങളുടെ ശമ്പള വിവരങ്ങളുടെ സുരക്ഷയ്ക്കായി പാസ്‌വേഡ് മറ്റാരുമായും പങ്കുവെക്കരുത്.'
    ]
  }
};

// Backward-compatible default export alias pointing to English manuals
export const MALAYALAM_USER_MANUALS: Record<ManualRoleKey, RoleUserManual> = ENGLISH_USER_MANUALS;

export function getUserManualsByLanguage(
  language: ManualLanguage = 'en'
): Record<ManualRoleKey, RoleUserManual> {
  return language === 'ml' ? MALAYALAM_EDITION_USER_MANUALS : ENGLISH_USER_MANUALS;
}

export const MANUAL_ROLE_ORDER: ManualRoleKey[] = ['owner', 'manager', 'accountant', 'staff'];
