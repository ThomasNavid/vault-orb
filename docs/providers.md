# Models and providers

[Documentation](README.md) · [Getting started](getting-started.md)

Choose models independently in **Settings → Models & voice**. Your existing OpenAI installation keeps its current defaults when you upgrade. Changing settings ends the current voice session and cancels pending work. Completed edits remain in Activity and can be undone where supported.

## Choose a setup

| Setup | Chat & tools | Voice mode | Required keys |
| --- | --- | --- | --- |
| OpenRouter typed chat | OpenRouter + a tool-capable model | Off | OpenRouter |
| Mixed voice | OpenRouter + a tool-capable model | OpenAI Realtime | OpenRouter, OpenAI |
| Voice without OpenAI | OpenRouter + a tool-capable model | Independent | OpenRouter, Deepgram, ElevenLabs |
| Existing OpenAI experience | OpenAI + a tool-capable model | OpenAI Realtime | OpenAI |

1. Paste the required keys under **Provider keys**. Leave a field blank to keep its saved key; check Remove saved key to delete it when saving. Keys are encrypted by macOS-backed Electron safeStorage.
2. Choose **Chat & tools provider**, click **Find models**, and search the model field. You can also enter a model ID. OpenRouter's catalog is filtered for text output and tool calling; OpenAI's catalog lists text candidates, so test your selection.
3. **Test model** makes a small billable request with a synthetic prompt and a harmless test tool. No vault data is sent and no vault tools execute. It checks basic tool compatibility, not the model's accuracy on your tasks.
4. Configure voice, or select **Off**. Save settings. Typed chat only requires the chosen chat provider and any separately enabled reasoning provider.

The app never automatically switches your configured provider or model after an error. OpenRouter chooses a host for the selected model according to its routing; the request requires supported parameters and disables host fallbacks. Availability and charges depend on the provider and your account. A successful catalog lookup does not prove inference or audio access.

## Voice choices

**OpenAI Realtime** provides the native speech conversation. Choose an available realtime model, speaking voice, and transcription model. Realtime delegates all vault requests through `run_task` to your selected chat/tools model, then speaks the confirmed result. Switching the tool model changes the model doing vault work, including routine reads and edits.

**Independent voice** uses Deepgram prerecorded transcription and ElevenLabs speech synthesis. Click **Find recognition models** and **Find speech models & voices**, then select models and a voice. Default model IDs are `nova-3` and `eleven_flash_v2_5`; the voice must come from your account or a valid voice ID. Both adapters are separate from the chat provider, so the pipeline can run without an OpenAI key.

Speech is detected locally. Pause for about a second to submit a turn. Each spoken turn is limited to 30 seconds; exceeding that limit ends voice with an error instead of submitting a partial request. Reconnect and use shorter turns. Speak again to stop playback and cancel pending work. Muting discards the current unsent recording. Ending voice or hiding Orb stops the microphone and cancels pending work. Audio buffers are not written to disk. The answer remains in the session transcript if speech synthesis fails; the app does not rerun the task to recover speech.

The independent pipeline waits for transcription, the tool response, and synthesized audio. It has more latency than realtime voice, and speaker echo/background noise can affect interruption detection. Headphones can help. It is not an offline mode.

## Optional advanced reasoning

Expand **Advanced reasoning** and enable a separate provider/model for complex planning. Otherwise chat/tools handles reasoning itself. When enabled, the chat model can delegate complex work using `think_deeply`. The reasoning model has the same vault tools but cannot delegate again. Both models share the bounded request budget. Only explicitly requested edits are permitted by the assistant instructions and tool contracts.

## Errors and verification

If a model rejects tools, choose another tool-capable model and rerun Test model. Model APIs differ in strict-schema support; Orb validates arguments locally before dispatching model tool calls. Duplicate call IDs within one model run reuse their results. There are no automatic retries of writes or silent provider changes. On errors or cancellation, check Activity before explicitly retrying an edit.

Offline tests cover provider routing, key migration, tool messages and reasoning state, malformed calls, deduplication, cancellation, and speech failures. Real account access, microphone recognition, voice quality and end-to-end latency require live checks with your own keys and a disposable vault. The browser preview does not send model requests.

See [Privacy and data](privacy.md) for which providers receive audio, text and retrieved vault content.
