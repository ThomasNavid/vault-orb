# Weather

[Documentation](../README.md) · [Privacy](../privacy.md) · [Today and Explore](today-and-explore.md)

Ask Smith about the weather and a forecast card opens beside the orb. It shows the temperature, the feels-like temperature and the next 12 hours, with advice about jackets and umbrellas. The orb reacts briefly too: it turns icy blue when it's cold and amber or red when it's hot, and a fine shimmer of rain runs through it when it's wet. After about five seconds it settles back to your own colour.

Forecasts come from [Open-Meteo](https://open-meteo.com/), which needs no account or API key. Weather is read-only and never writes to your vault.

## Set up

1. Open **Settings → Connectors → Weather**.
2. Type a town or city in **Home location** and choose the right match. Use the arrow keys and Return, or click. The place saves straight away and the card header shows its name.
3. Optionally choose **Celsius** or **Fahrenheit**. The default follows your Mac's region.
4. **Orb reacts to the weather** is on by default. Turn it off to keep the orb's colour when you check the weather. The card still appears.

You can ask about a named place without saving a home location.

## Things to ask

> Do I need a jacket?
>
> Will I need an umbrella this afternoon?
>
> What's the weather like tonight?
>
> Weather in Lisbon tomorrow.
>
> Is it going to be hot today?

In voice, Smith checks the weather directly rather than handing the request to the chat model, so answers come back quickly. Expect one short sentence, for example “Yes, a light one: it feels like 7° by six, with a 60% chance of rain after four.”

You can also open **Explore → Connectors → Weather**, or click the weather chip under the date in **Today**.

## What the card shows

- The place name. Hover it to see its region and country, and whether it's your saved place.
- The current temperature and conditions, with today's high and low. Feels-like appears only when it differs by 2° or more.
- One line of advice, for example **Light jacket and umbrella · rain likely around 16:00**, or **No jacket or umbrella needed**. Hover it to see the full reasoning, such as “feels like 6° at 18:00 · 60% chance of rain around 16:00”.
- The next 12 hours: time, icon and temperature, with the rain chance shown only when it's 20% or higher.
- Tomorrow's conditions and high/low, the update time, and small **Refresh** and **Location** buttons.

## How advice is decided

Advice is calculated by Orb from the forecast, not guessed by the AI model. All temperatures are feels-like, and the rules are tuned for the UK:

| Advice | When |
| --- | --- |
| Warm coat | The coldest hour feels below 8 °C. |
| Light jacket | The coldest hour feels 8–15 °C. |
| One step warmer | Gusts reach 40 km/h or more. |
| Umbrella | Any hour has a 40% or higher chance of rain, or at least 0.3 mm of rain. |
| Sun protection | Today's (or tomorrow's) UV index reaches 6. |

The window depends on what you ask. “Now” or no time means the next 12 hours, “today” means the rest of today, “tonight” means 18:00–06:00, and “tomorrow” means 07:00–22:00 tomorrow. Times are local to the place.

## Orb reactions

| Weather now | Reaction |
| --- | --- |
| Feels like 5 °C or colder | Icy blue |
| Feels like 26 °C or warmer | Amber |
| Feels like 32 °C or warmer | Amber-red |
| Raining now, or at least a 50% chance within 3 hours | Fine falling shimmer inside the orb |
| Snow | Slower, softer flecks |
| Mild and dry | No reaction |

A tint and the shimmer can combine. The reaction lasts about five seconds, then the orb returns to your chosen colour, which is never changed. It plays only when a forecast arrives live beside the orb. It doesn't play in the chat window, when you reopen a saved chat, or when you press Refresh. With **Reduce motion** on in macOS, the tint appears and leaves without animation and there is no shimmer.

## Limits

- One saved home location. Named places use the best match from Open-Meteo's place search, and the card shows which place was used.
- Current conditions plus 24 hours of hourly data, and tomorrow's summary. No multi-day view, weather alerts, radar or air quality.
- Forecasts are cached for 10 minutes. If the network fails, a forecast from the last 2 hours is shown and labelled **offline**. Older forecasts are not used.
- Open-Meteo's free service is for non-commercial use.

## Privacy

Orb requests forecasts from the main process only. It sends coordinates rounded to 2 decimal places (about 1 km), or the place name you asked about for the place search. No vault content, account details or name is sent. Browsing the card from Explore or Today makes no AI request. Asking Smith sends the forecast and advice to your selected AI provider, and typed answers with their weather cards may be saved in local chat history.

## Troubleshooting

| Symptom | Check or action |
| --- | --- |
| “Set your weather location…” | Choose a home location in **Settings → Connectors → Weather**, or name a place in your request. |
| “Weather unavailable” | Check your internet connection and press **Retry**. The service times out after 8 seconds. |
| Wrong town | Named places use the top search match. Add the region or country (“Paris, Texas”), or save the exact place in Settings. |
| The orb didn't change colour | Mild, dry weather has no reaction. Check **Orb reacts to the weather** in Settings, and note that chat-window and saved-chat cards don't react. |
| Temperatures in the wrong units | Switch **Temperature** in Settings. Advice thresholds always use °C internally. |
