# Wabb 🍓

A sweet, strawberry-themed monthly habit tracker.

## Features
- Full Sunday–Saturday monthly calendar, including five- and six-week months
- Pink date circles and daily habits with clickable completion circles
- Navigate between months or jump to the current month
- Add, rename, and remove daily habits (up to eight for readability)
- Completion percentage for the displayed month
- Automatically saves habits and checked circles in your browser using localStorage
- Responsive layout; scroll the calendar horizontally on smaller screens
- Accessible button labels and keyboard interactions

## Run it

Open `index.html` in your browser. No installation, build tools, or accounts needed.

Alternatively, serve the directory with `python3 -m http.server 8000` and visit `http://localhost:8000`.

## Storage

Data is saved **locally in each browser**. It will persist through refreshes, but it does not sync between devices or browsers. Clearing site storage deletes the saved data.

## Deploy on GitHub Pages

In your repository, go to **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/(root)`, then save. Your site will be available at your GitHub Pages URL once GitHub publishes it.

## Files

- `index.html`: page structure and habit editor
- `styles.css`: strawberry-themed layout
- `app.js`: calendar logic, habit management, and local saving
