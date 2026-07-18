# Blinkit AI Review Discovery Engine 🛒

An AI-powered product discovery and review analysis engine built as a Product Management case study for Blinkit (Quick Commerce). 

This tool ingests unstructured user feedback, app reviews, and social discussions, and uses an LLM to automatically categorize them into actionable product themes (e.g., Category Discovery, Habitual Buying, Cross-Sell, Performance) to help product teams uncover hidden user needs and friction points.

---

## 🚀 Features

- **Automated Categorization**: Uses a Large Language Model to categorize unstructured feedback into predefined quick-commerce themes.
- **Sentiment & Priority Analysis**: Automatically scores the sentiment (positive, negative, mixed) and assigns a priority level to incoming reviews.
- **Actionable Insights Dashboard**: A highly dense, analytical UI highlighting Cumulative Metrics, Emerging Trends, Top Pain Points, and AI widgets for User Personas and ICE Scoring.
- **Unblocked Hugging Face AI Chat**: Integrates with the new OpenAI-compatible Hugging Face Router (`router.huggingface.co/v1`) to run high-quality inferences bypassing local DNS firewalls.
- **Automated Sync Scheduler**: Fully integrated with GitHub Actions/cron scheduler running at 10:00 AM daily, guaranteeing a pull of at least 50 fresh reviews from active sources.
- **Dynamic Reports Tab**: Fully synchronized with database metrics, showing dynamic averages, topic counts, and sentiment trends in real-time.

---

## 💡 Key PM Questions Answered
The discovery engine helps the product team answer critical product-discovery questions, such as:
1. **Why do users repeatedly buy from the same categories?** (Exploring habitual quick-commerce behavior)
2. **What prevents users from exploring new categories?** (Identifying friction points in discovery)
3. **How do users discover products today?** (Analyzing entry points like search, banners, and filters)
4. **What role do habits play in shopping behavior?** (Uncovering recurring order patterns)
5. **What information do users need before trying a new category?** (Determining informational gaps like expiration dates or size guides)
6. **What frustrations emerge repeatedly?** (Spotlighting out-of-stock items, delivery delays, and payment bugs)
7. **Which user segments are more likely to experiment?** (Identifying behavior profiles of experimenters)
8. **What unmet needs emerge consistently across discussions?** (Validating product opportunities)

---

## 🛠️ Technology Stack

This project is built using a modern, focused stack:

- **Frontend / Framework**: [Next.js 15](https://nextjs.org/) (App Router, React, Tailwind CSS, shadcn/ui)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Prisma ORM](https://www.prisma.io/))
- **AI / LLM Inference**: 
  - **Primary**: Hugging Face Inference API via Router Client (`Qwen/Qwen2.5-Coder-32B-Instruct` model)
  - **Backup**: Google Gemini API (`gemini-2.5-flash` model)
- **Embeddings**: `xenova/transformers` (Local, in-memory embeddings for Semantic Search)
- **Auth**: Scrypt + JWT (Custom stateless session management)

*(Note: Unused legacy integrations such as Spotify references and Firebase Admin have been entirely removed to keep the repository lean and focused on the core quick-commerce use-case.)*

---

## 📦 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- A running PostgreSQL database (e.g., local Postgres, Neon, Supabase, or Railway)
- A [Hugging Face](https://huggingface.co/) account (for a free API token)

### 2. Environment Variables
Create a `.env` file in the root of the project with the following:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/blinkit_db"
JWT_SECRET="local-development-secret-key-12345"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
HUGGINGFACE_API_KEY="hf_your_huggingface_token_here"
# Optional: GEMINI_API_KEY="your_google_gemini_token_here" (For Google AI Studio fallback)
```

### 3. Installation

```bash
# Install dependencies
npm install

# Run database setup & migrations
npx prisma db push

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 💡 Usage (PM Demo)

1. **Bootstrapping / Setup**: Log in using the default admin credentials:
   - **Email**: `pm@reviewpulse.dev`
   - **Password**: `ReviewPulse123!`
2. **Seeding Blinkit Data**: Go to the **Settings** or **Sources** page in the dashboard and trigger a sync. This will populate the system with 50 high-quality, quick-commerce-focused Blinkit reviews covering missing items, delivery issues, payment gateway status, and category exploration.
3. **Insights & Reports**: Visit the **Overview** or **Reports** tabs to see the aggregated insights, ICE scoring mockups, and dynamic sentiment breakdowns.
4. **AI Chat**: Visit the **AI Chat** tab to ask any of the critical PM questions and see the Semantic RAG Search in action.
