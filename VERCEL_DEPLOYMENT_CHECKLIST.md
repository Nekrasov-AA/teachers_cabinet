# Vercel Deployment Checklist ✅

## 1. ✅ Build проверен
```bash
npm run build
```
**Статус:** ✅ **Успешно** - все 22 routes собраны без ошибок

## 2. ✅ Production dependencies
**Playwright и dotenv в devDependencies** - не попадут в production:
- `@playwright/test` - только для тестов
- `dotenv` - только для локальной разработки
- Все остальные dev-инструменты (TypeScript, ESLint, Tailwind) - OK

## 3. ⚠️ Environment Variables для Vercel

### Обязательные переменные для Production:

Добавьте в **Vercel Project Settings → Environment Variables** (для Production):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://uyjnwrwyggsjlflljbis.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5am53cnd5Z2dzamxmbGxqYmlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTI5MjUsImV4cCI6MjA4MjQ2ODkyNX0.nAy1T4jXdaYqxhDSybctK1vJ_CXnJ3Z0e7z8UhcWoac

SUPABASE_URL=https://uyjnwrwyggsjlflljbis.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5am53cnd5Z2dzamxmbGxqYmlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4OTI5MjUsImV4cCI6MjA4MjQ2ODkyNX0.nAy1T4jXdaYqxhDSybctK1vJ_CXnJ3Z0e7z8UhcWoac
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5am53cnd5Z2dzamxmbGxqYmlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg5MjkyNSwiZXhwIjoyMDgyNDY4OTI1fQ.PQkOsZpZxIIPKbgLZ0Of8m6vtAag_LbHsduS09tWS3M
```

### ❌ НЕ добавляйте в Vercel (только для локальных тестов):
```bash
# Эти переменные только для локального e2e тестирования
E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
E2E_TEACHER_EMAIL
E2E_TEACHER_PASSWORD
```

### ℹ️ Postgres переменные (опционально):
Если используете прямые подключения к Postgres:
```bash
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
```
*(На данный момент проект использует Supabase SDK, эти переменные не обязательны)*

## 4. ✅ Middleware Warning

⚠️ Warning при сборке:
```
The "middleware" file convention is deprecated. Please use "proxy" instead.
```
**Решение:** Это предупреждение Next.js 16+, не влияет на production. Можно переименовать `middleware.ts` → `proxy.ts` в будущем.

## 5. ⚠️ Автодеплой отключен

**Текущая настройка:** Автоматический деплой при пуше в `main` **отключен** (см. `vercel.json`)

### Процесс ручного деплоя:

1. **Push в GitHub**:
```bash
git push origin main
```
> ⚠️ Автодеплой не запустится

2. **Ручной деплой через Vercel Dashboard**:
   - Открыть https://vercel.com/dashboard
   - Выбрать проект
   - Deployments → нажать "Deploy" вручную
   - Или через CLI: `vercel --prod`

3. **Environment Variables** (если не добавлены):
   - Settings → Environment Variables
   - Добавить все переменные из раздела 3 выше
   - Scope: Production

4. **Включить автодеплой позже**:
   - Удалить `vercel.json` или изменить на:
   ```json
   {
     "git": {
       "deploymentEnabled": {
         "main": true
       }
     }
   }
   ```

### Проверка после деплоя:

```bash
# Проверить health endpoint
curl https://your-app.vercel.app/api/health

# Проверить что Supabase подключён
# Должно вернуть {"ok": true, ...}
```

## 6. 📋 Post-Deploy Tasks

- [ ] Проверить логин: `https://your-app.vercel.app/login`
- [ ] Создать тестовый раздел
- [ ] Загрузить тестовый файл
- [ ] Импортировать Excel
- [ ] Проверить что teacher-роль работает корректно (может читать, но не писать)

## 7. 🔐 Security Notes

- ✅ Service Role Key - используется только на сервере (Admin Client)
- ✅ Anon Key - безопасно для клиента (Row Level Security включён)
- ✅ E2E credentials - не попадают в production
- ✅ Файловые лимиты настроены (10MB, 2000 rows)

## 8. 📊 Monitoring

После деплоя отслеживайте:
- Vercel Analytics (автоматически)
- Vercel Logs для ошибок API
- Supabase Dashboard → Logs для БД запросов
- Supabase Storage для файлов

---

## ✅ Все готово к деплою!

**Build:** ✅ Проходит  
**Dependencies:** ✅ Правильно разделены  
**Env Variables:** ✅ Список подготовлен  
**Security:** ✅ Настроена  
**Limits:** ✅ Реализованы  

🚀 Можно деплоить!
