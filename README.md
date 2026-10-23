# RAG System with Express, LangChain, Qdrant & Groq

A Retrieval-Augmented Generation (RAG) system built with Node.js and Express that answers questions from documents using Qdrant vector database, Google Generative AI embeddings, and Groq LLM.

## Features
- **Document Loading & Parsing**: Parses PDF documents (`knowledge.pdf`) using `pdf-parse`.
- **Text Splitting**: Splits text into chunks using `RecursiveCharacterTextSplitter`.
- **Vector Embeddings**: Uses Google Generative AI embeddings (`gemini-embedding-001`).
- **Vector Storage**: Qdrant Vector Database (`grocery-store` collection).
- **LLM Reasoning**: Groq-hosted LLM (`openai/gpt-oss-120b`).
- **Context-Strict Q&A**: Answers strictly based on the retrieved context.

## Setup & Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` (refer to `.env.example`):
   ```env
   GROQ_API_KEY=your_groq_api_key
   GOOGLE_API_KEY=your_google_api_key
   QDRANT_URL=your_qdrant_url
   QDRANT_API_KEY=your_qdrant_api_key
   ```

3. Run the server:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /`: Health check.
- `POST /ai`:
  - **Body**: `{"input": "what is fresh basket"}`
  - **Response**: `{"ai": "..."}`
