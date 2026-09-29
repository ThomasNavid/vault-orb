# Trading 212

[Documentation](../README.md) · [Privacy](../privacy.md) · [Implementation roadmap](../trading212-improvement-plan.md)

Connect an Invest or Stocks ISA account to browse investments and ask Smith about supported financial data. The connector is read-only: it cannot trade, cancel orders, transfer money or change Pies. Dashboard browsing and local calculations make no AI requests and require no AI-provider key. Investments remain separate from the knowledge system's Portfolio notes.

## Connect

1. In Trading 212, open **Settings → API (Beta) → Generate API key**. Enable **Accounts data**, **History dividends**, **History orders**, **History transactions**, **Orders read**, and **Portfolio** (options 1, 3, 4, 5, 8 and 11 in the current permission list). Keep both the **API key and API secret**; the secret is shown only once.
2. Open **Orb Settings → Integrations → Trading 212**, select Live or Demo and enter both credentials.
3. **Test connection** checks each read capability without saving. Inspect the individual results; a working summary does not imply access to every history view. A denied capability can mean a missing permission or an IP restriction.
4. **Connect & save** saves the encrypted pair independently of other Settings. Partial capabilities remain visible; usable views still work.
5. Open **Explore → Trading 212** or `/trading212`. Use `@Trading212` in typed investment questions.

**Orders execute** and **Pies write** should remain off. The separate **History**, **Metadata** and **Pies read** options are not used. Accounts data supplies the account summary; Portfolio supplies holdings; the three History permissions supply dividends, fills and cash; Orders read supplies pending orders.

Leave both fields blank to keep the saved pair. Replacing a connection or changing environments requires both credentials. One account is connected at a time. The broker account identity and environment keep local histories separate; rotating a key for the same account preserves its tracking preference. Connecting a different account leaves tracking off until enabled for that account.

## Enable local performance tracking

Tracking is optional and off for existing connections until enabled. In the Trading 212 Settings card:

1. Set the reporting timezone, for example `Europe/London`.
2. Choose **Enable / resume tracking**. This starts encrypted local account observations and a resumable history scan.
3. Use **Check sync status** to inspect last capture, loaded pages, history coverage, errors, record count and storage size.
4. **Pause** stops collection but retains the stored history. **Rescan all history** enables tracking and restarts coverage scans, retaining existing records while they are checked.

Orb captures about every five minutes while it runs and the Mac is awake; an active dashboard can request one-minute capture. Hiding the window or stopping a conversation does not stop tracking. Quitting, pausing, disconnecting and Mac sleep interrupt collection. On resume, Orb refreshes without inventing missed observations. It does not prevent sleep or install a cloud collector.

History pages are paced separately and deduplicated by broker references. The beta API does not promise event ordering, so Orb follows pages to exhaustion before declaring a scan complete. Large histories can take time. Cash and fill history must both cover the closing valuation before a period return is available: a securities transfer may appear in fills without a cash deposit. A current valuation ahead of verified history uses an earlier covered close, with its actual time and freshness shown.

## What the numbers mean

| Metric | Meaning |
| --- | --- |
| Account value | Trading 212's account-currency total, including cash; used only after cash/investment reconciliation for period returns. |
| Open holdings · since purchase | Current unrealised gain divided by current cost basis. This is not today's return or lifetime account performance. |
| Period investment gain | Closing account value minus opening account value minus classified external contributions, with withdrawals treated as negative flows. |
| Period return | Gain divided by opening value when there are no external flows; a labelled Modified Dietz estimate when funds arrive or leave during the period. |
| Realised gain · all time | The broker's account-summary figure, distinct from a queried fill-history period result. |
| Income | Paid distributions and cash/lending interest, with category and currency separation. It is not added to total account return again. |

Buys and sells within the account are not deposits or withdrawals. Missing amounts remain unavailable, not zero. A non-positive return denominator has no displayed percentage. Unknown transfers, unsupported corporate actions, missing currencies, inconsistent totals, capture-boundary funding events or incomplete history can block a return. Figures are financial summaries, not tax-return calculations.

**Today** starts at midnight in the saved reporting timezone. A baseline within five minutes is explicitly estimated and shows the actual observed start. If the first observation is at 10:05, Orb cannot calculate a full day from midnight: use **Since tracking began**. A previous-afternoon snapshot cannot stand in for today's opening value after an overnight shutdown. Broader permissions do not recover a missing baseline.

Periods include Today, 7 days, 30 days, 90 days, YTD, 365 days, Since tracking began, this calendar month, calendar year, UK tax year (6 April–5 April), and custom inclusive calendar dates. The exact requested and observed times are displayed. “Since tracking began” is not a lifetime return. The metric may differ from Trading 212's app because timing, cash scope and methodology can differ. Fetched-at times are not guaranteed market-quote times.

## Views

- **Overview:** account/cash/investment values, since-purchase percentage, daily availability, separate section timestamps and allocation. Allocation can include cash or use investments only.
- **Holdings:** search names, tickers and ISINs; sort value, gains, losses, return percentage or name. Weights include all valid holdings, even when search hides rows. Select a holding for identifiers, quantities, prices, cost, FX impact, recorded prices from the latest 200 local observations, and up to 100 locally loaded fills. Detailed observations are kept for 90 days.
- **Performance:** selected-period amount and percentage, availability/estimate reason, actual times, method and evidence references. Switch between account-value and investment-return charts. Deposits affect account value but are adjusted out of return. Funding events are marked; gaps over ten minutes are not joined; large charts are sampled to around 100 points, with a data table.
- **Income:** distribution/interest, deposit, net-contribution and realised-result queries; group by month, holding or category and select dates. Currencies are kept separate. Complete totals are as of the reported history coverage; incomplete totals are labelled partial. Net contributions need fill coverage to rule out securities transfers.
- **Activity:** broker fills, cash movements and pending orders. Filter loaded rows by date, text, event type and currency. Income also links to raw payment records. Manual pagination remains available and clearly states when more pages exist.

Refresh preserves filter choices. Overview and metric cards refresh approximately every minute while visible, except saved snapshots. You can switch views while a request is loading. Backend rate limits may delay a refresh. Errors preserve displayed data and its earlier timestamp.

Reopened chat cards say **Saved snapshot**. Refresh requires the same account identity. Older cards without an identity remain readable; open the current account from Explore instead of refreshing them into a different account.

## Ask Smith

These requests read financial data; they do not change your account:

- “How much am I up today?” — uses the shared performance result or explains the missing baseline/history.
- “What is my return since buying?” — uses current open-holdings gain and cost.
- “How much income did I receive this UK tax year?” — uses the local ledger and reports its coverage.
- “How much did I deposit this month?” — queries deposits from the start of the current calendar month.
- “Which holdings have the biggest unrealised losses?”
- “Do I have any pending orders?”

The assistant uses the same calculated period metrics as the dashboard. It does not paginate an entire year through repeated model calls. Local collection continues separately when enabled; check sync status if the required history is incomplete. Without tracking, current holdings and raw broker pages still work.

Asking Orb sends relevant retrieved financial data to configured AI providers; voice answers use the configured voice providers too. Credentials and the broker account number are excluded. Saving a financial review to a vault note requires an explicit request and follows normal note-edit undo rules.

## Export, disconnect and delete

Local history appears below the tracking controls, including histories retained after disconnecting or replacing an account.

- **Export JSON** opens a save dialog and writes an **unencrypted** account-history file with observations, events, coverage and record references. Choose its destination carefully; it is not an official broker tax report.
- **Disconnect** removes credentials, stops collection and clears live caches. It retains encrypted local history. It does not revoke the broker key.
- **Delete history** asks for confirmation, stops tracking that account and removes its local records. It does not delete saved chats, vault notes, exported files, device backups or broker data.

Summary observations, event history and sync evidence remain until explicitly deleted. Detailed holding observations expire after 90 days; they are not inputs to account-return calculations. See [Privacy](../privacy.md#trading-212) for encryption and file locations.

## Limits and troubleshooting

- The API supports Invest and Stocks ISA, not SIPP, Cash ISA or CFD. Multi-currency accounts are documented as unsupported; wallet values use the primary currency. Share prices can use another currency, including GBX pence.
- No external stock-price/FX integration, historical account backfill, news/fundamentals, daily holding attribution, combined-account view, Pies, broker report generation or trading actions are included. The [roadmap](../trading212-improvement-plan.md) records those deferred choices.
- **Denied view:** inspect that capability and check its read permission and any IP restriction. A laptop's public IP can change across networks.
- **Missing daily figure:** check tracking, opening observation and both cash/fill coverage. Use a supported observed period; this does not necessarily indicate a broken connection.
- **Rate limit/stale data:** check actual fetch/coverage times and retry information. Limits apply per account across applications. Large full scans can leave current totals behind the latest quote.
- **Encryption/storage error:** history fails closed without plaintext fallback. Preserve the history directory and its key together when restoring backups.
- **Preview:** all browser figures are fictional. Preview cannot connect, enable tracking or export an actual account.

Implementation: [API client](../../src/trading212.cjs), [local service](../../src/trading212-service.cjs), [metrics](../../src/trading212-metrics.cjs), [dashboard](../../src/trading212-ui.js), [tests](../../test/trading212-performance.test.cjs). See [development](../development.md#trading-212-connector).

API references checked 29 September 2026: [public API](https://docs.trading212.com/), [OpenAPI schema](https://docs.trading212.com/_bundle/api.yaml), [key setup](https://helpcentre.trading212.com/hc/en-us/articles/14584770928157-Trading-212-API-key). The public API is in beta.
