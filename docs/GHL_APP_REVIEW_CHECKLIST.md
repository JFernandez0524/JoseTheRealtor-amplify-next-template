# GHL Marketplace App Review — Post-Approval Checklist

This checklist contains the actions to take in the **GoHighLevel Developer Portal** and AWS Amplify once GHL finishes reviewing and approving your Marketplace App.

---

## 📌 Marketplace Submission & Review Standards

### Whitelabeled Installation URL Requirement
GoHighLevel App Marketplace requires all installation / authorization URLs originating from public marketplace apps to use the official whitelabeled domain:
* **Authorization Base URL:** `https://marketplace.leadconnectorhq.com/oauth/chooselocation`
* **Webhooks & API Base URL:** `https://services.leadconnectorhq.com`
* **Contact Links in App UI:** `https://app.leadconnectorhq.com/v2/location/{locationId}/contacts/detail/{contactId}`

---

## 📌 Post-Approval Tasks for `dealfinder.yourailaunch.com`

### 1. Update GHL Developer Portal App Settings
Once GHL unlocks your app settings after approval:
1. Log into **GHL Developer Portal** (`developers.gohighlevel.com`).
2. Go to **Apps** → Select your App → **Keys & Redirect URIs**.
3. Under **Redirect URIs**, add:
   * `https://dealfinder.yourailaunch.com/api/v1/oauth/callback`
   *(Keep `https://leads.josetherealtor.com/api/v1/oauth/callback` listed as well for dual-domain support).*
4. Click **Save**.

---

### 2. Verify GHL OAuth Flow on New Domain
1. Log into `https://dealfinder.yourailaunch.com`.
2. Go to **Profile → Launch AI Integration** and click **Connect Launch AI**.
3. Confirm that the OAuth flow completes and redirects back to `https://dealfinder.yourailaunch.com/profile?setup=1`.

---

### 3. (Optional) Update Environment Variable in AWS Amplify
In **AWS Amplify Console** → **App settings** → **Environment variables**:
* Set `GHL_REDIRECT_URI` = `https://dealfinder.yourailaunch.com/api/v1/oauth/callback` (or leave it unset to use dynamic auto-detection).
