# Deploy backend to Vercel

1. **Connect** the repo to Vercel (if not already).
2. **Root Directory:** In Project Settings → General, set to **`backend`**.
3. **Redeploy** (or push to the branch Vercel deploys from).
4. **Test:** `https://YOUR-PROJECT.vercel.app/api/v1/health`

If you get 404, check the deployment’s **Functions** / **Runtime Logs** in Vercel for import or runtime errors.
