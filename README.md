# J-Card Genesis 📼

> **v2.0.0 Update**: **Global Localization & Multi-AI Support**. The app is now fully localized in English and supports **OpenAI (GPT-4/DALL-E)** and **Google Gemini** in addition to Alibaba DashScope.

<img width="1400" height="900" alt="image" src="https://github.com/user-attachments/assets/acd17866-ce31-4c21-9c5c-ebf01fe85cc9" />

**J-Card Genesis** is a desktop application designed for cassette collectors and DIY enthusiasts. It combines modern AI technology to help you easily create professional, beautiful physical cassette covers (J-Cards).

## ✨ Key Features

*   **Smart AI Engine**:
    *   **Multi-Provider Support**: Choose between **Alibaba DashScope (Qwen/Wanx)**, **OpenAI (GPT/DALL-E)**, or **Google Gemini** to power your creative process.
    *   **AI Art Director**: Automatically generates color schemes, mood descriptions, and auditory notes based on your tracklist.
    *   **Granular Control**:
        *   **✨ Magic Slogans**: A dedicated "Magic Wand" generating 1-3 lines of poetic, non-commercial copy.
        *   **🎨 Prompt Generator**: Analyzes track moods to generate precise illustration prompts in specific styles (Watercolor, Retro Magazine, Diary, Minimalist).
    *   **AI Cover Generation**: One-click generation of high-quality, artistic cover images.
*   **Professional Layouts**:
    *   **U-Card Support**: 4-panel foldable layout offering more space than traditional J-Cards, perfectly wrapping the cassette case.
    *   **Modes**: **Standard**, **Classical** (with movement grouping), and **Compilation** (artist per track).
*   **Smart Data Import**:
    *   **MusicBrainz Integration**: Search and auto-fill album metadata directly from the database.
    *   **Smart Paste**: Paste raw text from Spotify, Apple Music, or NetEase Cloud Music; AI automatically extracts tracks and times.
*   **Print Ready**:
    *   Optimized for **Canon SELPHY CP1500** and other 6-inch (4R, 100x148mm) photo printers.
    *   Export as **SVG** (Vector) or **PNG** (High-Res).
*   **Customization**:
    *   **Dark/Light Mode**.
    *   **Archival Metadata**: Record **Source** (Vinyl/SACD), **Equipment**, and **Recording Date**.
    *   **Borderless Covers**: Full-fit cover images with zero gaps.

---

## 🚀 Quick Start Guide

### 1. Get an API Key (Required)
This app relies on AI services (LLMs) to function. You need an API key from one of the supported providers:

*   **Alibaba DashScope**: [Get Key](https://bailian.console.aliyun.com/) (Supports Qwen & Wanx).
*   **OpenAI**: [Get Key](https://platform.openai.com/api-keys) (Supports GPT-4 & DALL-E 3).
*   **Google Gemini**: [Get Key](https://aistudio.google.com/app/apikey) (Supports Gemini 2.5 & Imagen 3).

**Setup**:
1.  Open the app and click the **Settings (⚙️)** icon in the top right.
2.  Select your **AI Provider**.
3.  Paste your **API Key** and click **Done**.

### 2. Basic Workflow
1.  **Input Data**:
    *   **Manual**: Type in Album Title, Artist, and Tracks.
    *   **Search**: Use the **MusicBrainz** button to find an album.
    *   **Paste**: Click **Paste Text** and drop in a tracklist from any streaming service.
2.  **AI Enhancement**:
    *   Click **AI Art Director** to auto-fill metadata and suggest a color scheme.
    *   Use the **Magic Wand (✨)** next to the Slogan field for poetic copy.
    *   Use **AI Generate Prompt** to create a visual description for the cover.
3.  **Create Cover**:
    *   Click **Generate Image** to create stylized art based on your prompt.
    *   Or click **Upload Image** to use your own local photo.
4.  **Layout & Style**:
    *   Choose a **Layout Mode** (Standard/Classical/Compilation).
    *   Toggle **Minimal Spine** or **Force Caps** for visual tweaks.
5.  **Export**:
    *   Click **Export SVG** for the highest quality print.
    *   Click **Export PNG** for digital sharing or quick printing.

---

## 🖨️ Printing Guide

**Recommended Device**: Canon SELPHY CP1500 (or similar 4R photo printers).

*   **Paper Size**: 6 inch / 4R (100x148mm).
*   **How to Print**:
    *   Export the **PNG** file.
    *   Print it directly on 4R paper **borderless** (100% scale).
    *   No cutting needed for the outer edges; just print, fold, and insert.

**The Layout (U-Card Style)**:
1.  **Front**: Main cover art.
2.  **Spine**: Main Title and Catalog Number.
3.  **Back**: Folded inner flap (usually Side A tracks).
4.  **Extension**: Extra panel (Side B tracks, credits).

---

## ❓ FAQ

**Q: Why is image generation slow?**
A: AI image models (like Wanx 2.5 or DALL-E 3) are computationally intensive. It typically takes 30-60 seconds to generate a high-res image.

**Q: I can't find cover art via MusicBrainz?**
A: MusicBrainz depends on community contributions. If an album has no cover art uploaded there, we can't fetch it. You can generate one with AI or upload a local file.

**Q: How do I fix incorrect track times?**
A: Pasting a tracklist with times (e.g., "Song Name 3:20") into the **Paste Text** window is the fastest way to correct bulk data.

---

## 🛠️ Development

Prerequisites: Node.js, NPM.

```bash
# Clone
git clone https://github.com/epochaudio/J-Card-Generator.git

# Install
npm install

# Dev Mode
npm run electron:dev

# Build (Mac/Win based on OS)
npm run electron:build
```

## 📄 License

© 2025 **Epoch Audio**. All Rights Reserved.
*Made with ❤️ for Cassette Culture.*
