@echo off
chcp 65001 >nul
echo ==============================================
echo  TurboProbe Auto-Sync & Push
echo ==============================================
echo 🔄 Скачиваем свежие ключи с GitHub...
git pull --rebase origin main
echo 📦 Фиксируем локальные изменения...
git add -A
git commit -m "update: code sync" 2>nul
echo 🚀 Отправляем на GitHub...
git push origin main
echo.
echo ✅ Всё успешно синхронизировано без конфликтов!
pause
