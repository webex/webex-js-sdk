# Testing the PR Comment Bot in Your Fork

## ✅ What Was Modified

The PR comment bot workflow has been updated with manual testing capabilities:

### 1. Added Manual Trigger (`workflow_dispatch`)
- You can now manually run the bot from GitHub Actions UI
- Input field for test version number (default: 3.3.1)
- No need to wait for Deploy CD workflow

### 2. Updated Job Condition
- Bot runs when Deploy CD completes (production) OR when manually triggered (testing)
- Works in both scenarios

### 3. Smart Version Detection
- **Test Mode:** Uses the version you specify in the manual trigger
- **Production Mode:** Automatically detects version from package-tools

### 4. Optimized Build Step
- Skips building tools in test mode (faster testing)
- Still builds in production mode

## 🧪 How to Test in Your Fork

### Step 1: Commit and Push

```bash
# Make sure you're on the right branch
git status

# Stage the modified file
git add .github/workflows/pr-comment-bot.yml

# Commit with a clear message
git commit -m "test: add manual trigger for bot testing in fork"

# Push to YOUR fork
git push origin bot-comment
```

### Step 2: Create a Test PR in Your Fork

1. Go to **YOUR fork** on GitHub: `https://github.com/YOUR_USERNAME/webex-js-sdk`
2. Click **"Compare & pull request"**
3. **IMPORTANT:** Set the base to YOUR fork:
   - Base repository: `YOUR_USERNAME/webex-js-sdk`
   - Base branch: `next` or `master`
   - Head repository: `YOUR_USERNAME/webex-js-sdk`
   - Compare branch: `bot-comment`
4. Create the PR
5. **Merge it immediately** (it's your fork, you can!)
6. **Note the PR number** (e.g., #1)

### Step 3: Manually Trigger the Bot

1. Go to **Actions** tab in your fork
2. Click **"PR Changelog Comment Bot"** in the left sidebar
3. Click **"Run workflow"** button (top right)
4. Fill in:
   - **Branch:** The branch you merged to (e.g., `next` or `master`)
   - **Test version number:** `3.3.1` (or any version)
5. Click **"Run workflow"**

### Step 4: Watch It Run

1. Refresh the page - you'll see the workflow running
2. Click on the running workflow to see logs
3. Wait ~2-3 minutes for completion
4. Look for ✅ green checkmark

### Step 5: Check Your PR

1. Go back to your test PR
2. Scroll to the comments
3. You should see the bot comment!

## 🎯 Expected Results

### Workflow Logs Should Show:

```
🧪 TEST MODE: Using manual version 3.3.1
📦 Current version: v3.3.1
📌 Previous tag: v3.3.0 (or empty if no tags)
Found X commits
Found 1 unique PRs: 1
Commenting on PR #1
✅ Successfully commented on PR #1
✨ Finished posting comments!
```

### Bot Comment Should Look Like:

```
🎉 Your changes are now available!

Released in: v3.3.1
Packages updated: webex, @webex/plugin-meetings, @webex/calling

📖 View full changelog →

This release includes X commits across the SDK. Thank you for your contribution!

---
🤖 This is an automated message...
```

## 🐛 Troubleshooting

### "No PRs found to comment on"
- **Cause:** PR number not found in commit messages
- **Check:** Look at git log to see if your PR # appears
- **Workaround:** The bot finds PRs from commit messages like "feat: something (#1)"

### "PR not merged, skipping"
- **Cause:** PR status is "Closed" not "Merged"
- **Fix:** Make sure you clicked "Merge" not "Close"

### Workflow fails on Build Tools step
- **Should not happen** - we made this step skip in test mode
- **If it fails:** Check the logs, might be a different issue

### Can't post comment
- **Check:** Are you in YOUR fork? (github.com/YOUR_USERNAME/...)
- **Check:** Does the PR exist and is it merged?

## 🔄 Testing Multiple Times

You can test as many times as you want:

1. Make changes to the workflow
2. Commit and push
3. Run workflow manually again (no need for new PR)
4. The bot will skip PRs it already commented on (duplicate prevention)

## 🚀 When Ready for Production

**Before submitting to main webex repo:**

1. **REMOVE the manual trigger** (optional, but cleaner):
   - Remove lines 5-10 in the workflow file
   
2. **REMOVE test mode logic** (optional, but cleaner):
   - Simplify version detection to always use package-tools

3. **Or keep it as-is** - it works in both modes!

The workflow will work perfectly in production even with the test trigger present.

## ✨ Key Benefits of This Setup

- ✅ Test in your fork without Deploy CD
- ✅ No NPM secrets needed
- ✅ Fast iteration (2-3 minutes per test)
- ✅ Safe environment (your fork)
- ✅ Easy to verify functionality
- ✅ Works in production too

## 📝 Quick Command Reference

```bash
# Commit changes
git add .github/workflows/pr-comment-bot.yml
git commit -m "test: add manual trigger for bot testing"
git push origin bot-comment

# After creating and merging PR, manually trigger from:
# GitHub → Actions → PR Changelog Comment Bot → Run workflow
```

---

**Happy Testing!** 🧪

If you encounter any issues, check the workflow logs in the Actions tab. The logs will tell you exactly what's happening at each step.

