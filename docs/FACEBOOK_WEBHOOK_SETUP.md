# Facebook Webhook Setup Guide

## Overview

This webhook handles:
- **Messenger conversations** - AI-powered responses to messages on your Facebook page
- **Lead Ads** - Automatic contact creation in GHL from Facebook lead forms
- **Page events** - Notifications for page activity

## Prerequisites

1. Facebook Business Page
2. Facebook App with Messenger and Lead Ads permissions
3. Page Access Token (never expires)

## Step 1: Create Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Business** type
4. Name: "Jose Fernandez Real Estate"
5. Add **Messenger** and **Webhooks** products

## Step 2: Get Page Access Token

1. In your app, go to **Messenger** → **Settings**
2. Under **Access Tokens**, select your page
3. Click **Generate Token**
4. **Important:** Convert to never-expiring token:
   ```bash
   curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=SHORT_LIVED_TOKEN"
   ```
5. Save the `access_token` from response

## Step 3: Configure Environment Variables

Add to Amplify Console → Environment Variables:

```env
META_VERIFY_TOKEN=your_random_string_here_12345
META_APP_SECRET=your_app_secret_from_facebook
FB_PAGE_ACCESS_TOKEN=your_never_expiring_page_token
```

**Generate verify token:**
```bash
openssl rand -hex 32
```

## Step 4: Deploy Lambda

```bash
git add amplify/functions/facebookWebhookHandler
git commit -m "Add Facebook webhook handler"
git push origin main
```

After deployment, get the Function URL:
```bash
aws lambda get-function-url-config --function-name amplify-d127hbsjypuuhr-ma-facebookWebhookHandlerla-XXXXX
```

**Your webhook URL:** `https://XXXXX.lambda-url.us-east-1.on.aws/`

## Step 5: Configure Facebook Webhooks

### For Messenger:

1. Go to your app → **Messenger** → **Settings**
2. Under **Webhooks**, click **Add Callback URL**
3. **Callback URL:** Your Lambda Function URL
4. **Verify Token:** The `META_VERIFY_TOKEN` you set
5. Click **Verify and Save**
6. Subscribe to these fields:
   - `messages`
   - `messaging_postbacks`
   - `message_echoes`

### For Lead Ads:

1. Go to **Webhooks** → **Page**
2. Click **Subscribe to this object**
3. Subscribe to field: `leadgen`

## Step 6: Subscribe Page to App

1. In **Messenger Settings**, find your page
2. Click **Subscribe** next to webhooks
3. Select all webhook fields

## Step 7: Test Messenger Integration

1. Send a message to your Facebook page
2. Check CloudWatch logs:
   ```bash
   aws logs tail /aws/lambda/amplify-d127hbsjypuuhr-ma-facebookWebhookHandlerla-XXXXX --follow
   ```
3. You should see AI response sent back

## Step 8: Add Messenger to Your Website

Add this code to `jose-fernandez.remax.com`:

```html
<!-- Facebook Messenger Plugin -->
<div id="fb-root"></div>
<div id="fb-customer-chat" class="fb-customerchat"></div>

<script>
  var chatbox = document.getElementById('fb-customer-chat');
  chatbox.setAttribute("page_id", "YOUR_PAGE_ID");
  chatbox.setAttribute("attribution", "biz_inbox");

  window.fbAsyncInit = function() {
    FB.init({
      xfbml: true,
      version: 'v18.0'
    });
  };

  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = 'https://connect.facebook.net/en_US/sdk/xfbml.customerchat.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
</script>
```

Replace `YOUR_PAGE_ID` with your Facebook page ID.

## Step 9: Create Lead Ad Campaign

1. Go to Facebook Ads Manager
2. Create campaign → **Lead Generation**
3. Create form with fields:
   - First Name
   - Last Name
   - Email
   - Phone Number
4. Publish campaign

When someone submits the form:
- Webhook receives lead data
- Contact created in GHL automatically
- Tagged with `facebook-lead`

## Troubleshooting

### Webhook not receiving events:
```bash
# Check if webhook is subscribed
curl -X GET "https://graph.facebook.com/v18.0/YOUR_PAGE_ID/subscribed_apps?access_token=YOUR_PAGE_TOKEN"
```

### Test webhook manually:
```bash
curl -X POST "YOUR_LAMBDA_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "messaging": [{
        "sender": {"id": "12345"},
        "message": {"text": "test"}
      }]
    }]
  }'
```

### View logs:
```bash
aws logs tail /aws/lambda/amplify-d127hbsjypuuhr-ma-facebookWebhookHandlerla-XXXXX --since 1h --follow
```

## Security Notes

- Never commit tokens to git
- Use environment variables in Amplify Console
- Webhook validates signature on every request
- Page Access Token should never expire

## Rate Limits

- Facebook: 200 messages/hour per page
- Lambda: 1000 concurrent executions
- DynamoDB: On-demand scaling

## Next Steps

1. Customize AI responses in `conversationHandler.ts`
2. Add custom postback buttons for quick replies
3. Set up Facebook Ads campaigns
4. Monitor conversion rates in GHL
