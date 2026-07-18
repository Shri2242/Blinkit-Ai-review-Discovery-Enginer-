# Blinkit AI Review Discovery Engine

An AI-powered product discovery and review analysis engine built as a Product Management case study for Blinkit (Quick Commerce). 

This tool ingests unstructured user feedback, app reviews, and social discussions, and uses an LLM to automatically categorize them into actionable product themes (e.g., Category Discovery, Habitual Buying, Cross-Sell, Performance) to help product teams uncover hidden user needs and friction points.

## 🚀 Features

- **Automated Categorization**: Uses a Large Language Model to categorize unstructured feedback into predefined quick-commerce themes.
- **Sentiment & Priority Analysis**: Automatically scores the sentiment (positive, negative, mixed) and assigns a priority level to incoming reviews.
- **Actionable Insights Dashboard**: A highly dense, analytical UI highlighting Cumulative Metrics, Emerging Trends, Top Pain Points, and mock AI widgets for User Personas and ICE Scoring.
- **Semantic Search**: "Chat with your reviews" using vector embeddings to find specific user quotes and generate aggregated summaries.

## 🛠️ Technology Stack

This project is built using a modern, focused stack:

- **Frontend / Framework**: [Next.js 15](https://nextjs.org/) (App Router, React, Tailwind CSS, shadcn/ui)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Prisma ORM](https://www.prisma.io/))
- **AI / LLM Inference**: 
  - Hugging Face Inference API (Free Tier LLM for classification and extraction)
  - `z-ai-web-dev-sdk` (Sandbox LLM fallback)
- **Embeddings**: `xenova/transformers` (Local, in-memory embeddings for Semantic Search)
- **Auth**: Scrypt + JWT (Custom stateless session management)

*(Note: Unused legacy integrations such as Firebase Admin and DeepSeek have been entirely removed to keep the repository lean and focused on the core PM use-case.)*

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A running PostgreSQL database (e.g. local Postgres, Neon, Supabase, or Railway)
- A [Hugging Face](https://huggingface.co/) account (for a free API token)

### 2. Environment Variables
Create a `.env` file in the root of the project with the following:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/blinkit_db"
JWT_SECRET="your_32_character_random_secure_string_here"
HUGGINGFACE_API_KEY="hf_your_token_here"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Installation

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 💡 Usage (PM Demo)

1. **Seed Data**: Go to the **Settings** page in the dashboard and click **"Reseed Database"**. This will populate the system with 50 mock Blinkit reviews covering various themes.
2. **Dashboard**: Visit the **Overview** or **Reports** tabs to see the aggregated insights, ICE scoring mockups, and dynamic sentiment breakdowns.
3. **AI Chat**: Visit the **AI Chat** tab to ask questions like *"Why do users repeatedly buy from the same categories?"* and see the semantic search in action.
