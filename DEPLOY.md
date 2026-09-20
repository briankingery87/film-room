# Publishing The Film Room

Same pattern as Ask the Atlas and Tux's Take.

## One time

1. Create a **public** repo on github.com named `film-room`. Do not add a
   README, a .gitignore or a licence - this folder already has them.
2. Open PowerShell in this folder: type `powershell` in the File Explorer
   address bar and press Enter.
3. Run these one at a time, and read what each one prints:

```
git init
git branch -M main
git add .
git commit -m "The Film Room, first build"
git remote add origin https://github.com/briankingery87/film-room.git
git remote -v
git push -u origin main
```

`git remote -v` should print the URL twice. If it prints nothing, the
`git remote add` line did not take - run it again. That was the failure on the
Ask the Atlas first push.

4. On github.com: **Settings > Pages**, source **Deploy from a branch**,
   branch **main**, folder **/ (root)**. Save.
5. About a minute later the site is live at
   `https://briankingery87.github.io/film-room/`

## Every time after that

Double-click `publish.bat`, type what changed, press Enter.

## A data refresh never needs a push

The page reads the services live. When Sunday's pipeline runs, the numbers on
the live site change on the next reload. You only push when the *app* changes.
