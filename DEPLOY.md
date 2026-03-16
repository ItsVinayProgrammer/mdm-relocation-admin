# MDM Admin Deployment Guide

## 1. Pre-deploy checks

1. Pull latest code:

```bash
git pull origin main
```

2. Install dependencies:

```bash
npm install
cd functions && npm install && cd ..
```

3. Confirm required local env values exist in `.env.local` for local testing:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_SUPER_ADMIN_EMAIL`

4. Build and verify PWA assets:

```bash
npm run build
```

## 2. Git release flow

```bash
git add .
git commit -m "Production update"
git push origin main
```

## 3. Vercel deploy (Frontend)

1. Trigger deployment:

```bash
vercel --prod
```

## 4. Firebase deploy (Hosting only, if applicable)

1. Login once:

```bash
firebase login
```

2. Verify active project:

```bash
firebase use mdm-website-23
```

3. Deploy hosting only:

```bash
firebase deploy --only hosting
```

## 5. Post-deploy validation

1. Open admin app and verify login works.
2. In Admin Settings, enable notifications for a test device.
3. Create a test booking and confirm push notification delivery.
4. Check activity logs and verify latest events are visible to super admin only.
