# Trading 212

[Documentation](../README.md) · [Privacy](../privacy.md)

Connect an Invest or Stocks ISA account to see its investments inside Orb. The connector only makes reads: it cannot place or cancel orders, transfer money, or change Pies. Opening the dashboard does not require an AI-provider key or make an AI request. The financial portfolio is separate from the knowledge system’s Portfolio notes, and the connector does not install an Obsidian plugin or add financial files to the starter vault.

## Connect

1. In Trading 212, open **Settings → API (Beta) → Generate API key**. Choose read permissions for account data, portfolio, history, and orders. Trading permissions are unnecessary. Keep the **API key and API secret**; Trading 212 displays the secret only once.
2. In Orb, open **Settings → Integrations → Trading 212**.
3. Choose **Live** for your real account or **Demo** for practice. Enter both credentials for that environment.
4. **Test connection** checks account-summary access without saving. **Connect & save** checks access and encrypts the credentials locally. This button saves the connection independently of the other Settings fields.
5. Open **Explore → Trading 212**, or choose `/trading212` from the typed-chat command menu. Use `@Trading212` when asking an investment question in chat.

Leave both credential fields blank to reuse the saved pair when testing or saving. Replacing a connection or changing environments requires both credentials. One account/environment is connected at a time. The saved status means credentials are stored; it is not a continuous health check. The connection test checks account access; other views can still report missing permissions.

**Disconnect** removes the saved credentials and clears backend cached account data. It does not revoke the key at Trading 212 or delete previously saved chats or vault notes. Revoke the pair separately in Trading 212 when appropriate.

## Views

| View | Contents |
| --- | --- |
| Overview | Account value, available cash, invested value, cost basis, unrealised return, all-time realised return, reserved/Pie cash, allocation bars. |
| Holdings | Share quantities, average price paid, current price, current value, unrealised return, and currency impact. |
| Dividends | Paid distributions, totals by currency, monthly totals, and a year filter over loaded records. |
| Activity → Trades | Historical fills, side/event, quantity, fill price, net cash value and realised return. |
| Activity → Cash movements | Deposits, withdrawals, transfers, fees, free-cash interest and lending interest returned by the API. |
| Activity → Pending orders | Current order details; viewing them cannot change or cancel them. |

Allocation is each holding's share of **invested value**, excluding cash. The chart shows at most the eight largest holdings but includes all holdings in the denominator. Missing or inconsistent values disable the calculation. Amounts unavailable from the API appear as `—`, never an assumed zero. Share prices use instrument currency; wallet values use account currency. GBX prices remain labelled in pence.

**Refresh** fetches new data when the endpoint's minimum interval allows it. Responses are cached in memory briefly (account and pending orders: 5 seconds; holdings: 1 second; history: 10 seconds). Update timestamps remain visible. There is no background polling or persistent portfolio-history database. Closing Orb cancels pending work. Errors retain the currently shown data and its earlier timestamp; incomplete Overview sections show warnings.

History starts with up to 50 records. **Load older records** follows the next page. It can take around ten seconds because of Trading 212's history rate limits. Totals and year filters only cover loaded records; the panel explicitly says when more history remains. Refresh starts again at the latest page. A history card restored from a chat may contain only one partial page; its notice explains this. After reconnecting or restarting the app, refresh before loading older records so different connections cannot be mixed. Dividends in different currencies are totalled separately. The API's dividend list can include other distribution types; the type is shown alongside each payment.

## Ask Orb

These requests read account data and display the financial panel:

- “Show my Trading 212 portfolio.”
- “Which holdings have the biggest unrealised losses?”
- “What percentage of my invested value is in my largest holding?”
- “Show my Trading 212 dividends.”
- “Show recent deposits and cash interest.”
- “Do I have any pending orders?”

For “How much did I receive in dividends this year?”, Orb must read enough history to support the answer, or explicitly report that the total covers only retrieved records. The assistant has a bounded tool budget and may need a narrower request for large histories. Unrealised profit/loss is not a daily performance measure.

Asking Orb sends relevant retrieved account data to your configured chat/reasoning provider; spoken answers also use the configured voice providers. Credentials are never included in model tool results. Typed responses and financial panel snapshots can be saved in local chat history under the normal retention rules. Dashboard browsing alone does not persist a financial snapshot. Saving a review to an existing vault note requires an explicit request and uses the normal note-edit undo journal.

## Limits and troubleshooting

- Only Invest and Stocks ISA are supported by this API; SIPP, Cash ISA and CFD are not.
- This version does not implement Pies, CSV report generation, historical performance charts, company news/fundamentals, or trading actions. No portfolio snapshots are collected in the background.
- **Rejected key:** check both credentials and the selected Live/Demo environment.
- **Denied access:** check the relevant read permissions and any API-key IP restrictions. A laptop's public IP can change when moving networks.
- **Rate limit:** wait before refreshing. Limits are shared across applications using the same Trading 212 account. Orb honours rate-limit reset responses and only exposes read endpoints.
- **Missing section:** the remaining sections stay available; an unavailable section does not mean the account has no holdings or activity.
- **Preview:** browser fixtures are clearly marked fictional. They cannot save credentials or connect to Trading 212. Live-account results require your own key and are not covered by the offline tests.

Implementation: [API client](../../src/trading212.cjs), [Settings and views](../../src/trading212-ui.js), [offline tests](../../test/trading212.test.cjs). See [development notes](../development.md#trading-212-connector) for the IPC and assistant contracts.

API references checked 29 September 2026: [public API reference](https://docs.trading212.com/), [OpenAPI schema](https://docs.trading212.com/_bundle/api.yaml), [official key setup guide](https://helpcentre.trading212.com/hc/en-us/articles/14584770928157-Trading-212-API-key). The public API is in beta.
