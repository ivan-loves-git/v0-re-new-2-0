# Product Update Email Template

**Sender:** Wavy 🌊 (Chief Notification Officer)
**Audience:** Internal team only
**Frequency:** Daily (when updates exist)

---

## Subject Line Format

```
Wave product update: vX.X.X – vX.X.X
```

Example: `Wave product update: v0.8.1 – v0.8.3`

---

## Email Structure

### 1. Header
- Re-New logo (from CDN)
- Clean, minimal

### 2. Greeting
```
Hey [Name] 👋
```

### 3. Intro (personality)
Witty, self-aware sentence acknowledging the creator relationship.

Example:
> "Since you're technically one of my creators, I owe you my spark of life. The least I can do is keep you posted on what I've been up to. Consider this my way of saying thanks."

### 4. Version Badge
```
v0.8.1 – v0.8.3
```

### 5. Headline
One punchy sentence summarizing the theme of updates.

Example:
> "This week I tightened security and cleaned house."

### 6. Updates List

Each update follows this format:

```
[emoji] Title (3-5 words)

Body: 12-15 words describing WHAT changed + BENEFIT to user.

Tags: [category] [lines changed] [time spent]
```

### 7. CTA
```
View full roadmap →
```
Links to: `/guide/roadmap`

### 8. Signature
```
[Witty one-liner sign-off]

**Wavy 🌊**
Chief Notification Officer
Re-New team
```

---

## Update Body Rules

**Length:** 12-15 words
**Structure:** What changed + Why it matters (benefit)

### Good Examples:
- "Fixed 10 vulnerabilities including SQL injection and API auth. Your data sleeps safer now." (14 words)
- "Switched to TypeScript-first authentication. Same login flow, faster sessions, better control." (11 words)
- "Removed 1,665 lines of dead code and unused dashboards. Builds are now noticeably faster." (14 words)

### Bad Examples:
- "Fixed security issues" (too short, no benefit)
- "We updated the authentication system to use a new library that provides better TypeScript support and improved session management capabilities" (too long, no clear benefit)

---

## Category Tags

Categories come FIRST, then meta tags (lines, time).

| Category | Color | Use for |
|----------|-------|---------|
| `security` | Green (#dcfce7) | Security fixes, vulnerabilities |
| `auth` | Blue (#dbeafe) | Authentication, sessions, login |
| `refactor` | Amber (#fef3c7) | Code cleanup, restructuring |
| `feature` | Indigo (#e0e7ff) | New functionality |
| `fix` | Pink (#fce7f3) | Bug fixes |
| `perf` | Cyan (#cffafe) | Performance improvements |

Meta tags (gray #f1f5f9):
- Lines changed: `+312 lines` or `-1,665 lines`
- Time spent: `~2h` or `~3.5h`

---

## Emojis for Titles

| Category | Emoji |
|----------|-------|
| Security | 🔒 |
| Auth | ⚡ |
| Refactor/Cleanup | 🧹 |
| Feature | ✨ |
| Fix | 🐛 |
| Performance | 🚀 |
| Database | 🗄️ |
| UI/Design | 🎨 |

---

## Sign-off One-liners

Rotate for variety:

1. "Back to work. Someone has to keep this ship running."
2. "That's all for now. Try not to miss me too much."
3. "Signing off before I start another refactor."
4. "Your inbox thanks me for keeping this short."
5. "Now if you'll excuse me, I have notifications to notify."

---

## Technical Implementation

**Script:** `scripts/send-roadmap-email.ts`

**Category:** Ivan's triggered emails (NOT automated)

**Workflow:**
1. Claude always sends test email to ivanpaudice@me.com first
2. Ivan reviews the test email
3. Only after Ivan confirms, Claude sends to full team

**Usage:**
```bash
# Test email (single recipient)
npx tsx scripts/send-roadmap-email.ts [email] [name] [version]

# Full team (8 people from FOUNDERS_TEAM_2_0)
npx tsx scripts/send-roadmap-email.ts --team [version]
```

**Examples:**
```bash
# Test to Ivan first
npx tsx scripts/send-roadmap-email.ts ivanpaudice@me.com Ivan 1

# After approval, send to full team
npx tsx scripts/send-roadmap-email.ts --team 1
```

---

## Checklist Before Sending

- [ ] Subject includes correct version range
- [ ] Each update body is 12-15 words
- [ ] Each update mentions what + benefit
- [ ] Category tags are first, colored correctly
- [ ] Sign-off is fresh (rotate them)
- [ ] Test email sent to yourself first
