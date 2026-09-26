# Task rules

This file is read by Vault Orb as the task conventions for this vault. Edit it to match how you work.

- In this sample vault, put personal tasks in `0. Home/Life Tasks` and work tasks in `0. Home/Business Tasks`. Other vaults can set both paths in Orb Settings.
- Use one Markdown note per task. The file name is the task title.
- Use `planned` for when you intend to work and `due` for a deadline. Leave either as `null` if unset.
- Dates use `YYYY-MM-DD`. Times, when needed, use local `YYYY-MM-DDTHH:mm:ss`.
- `category` is an optional grouping label. Work tasks can also have a `venture` label.
- Treat a task as complete only when `completed: true` is explicitly requested.

The app reads this note into its assistant instructions. Keep only conventions you want the assistant to follow.
