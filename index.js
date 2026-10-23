import express from "express"
import dotenv from "dotenv"
import { ChatGroq } from "@langchain/groq"
import fs from "fs";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import{QdrantVectorStore} from "@langchain/qdrant"
import { HumanMessage, SystemMessage } from "@langchain/core/messages";


dotenv.config();
const app=express();
const port=3000;


const llm = new ChatGroq({
    model: "openai/gpt-oss-120b",
    temperature: 0,
    maxTokens: undefined,
    maxRetries: 2,
    // other params...
})

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});
const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  collectionName: "grocery-store",
});

const upload = async ()=>{
       const pdfPath="./knowledge.pdf";
       const buffer = fs.readFileSync(pdfPath);
       const pdfResult=new PDFParse({data:buffer})
       const result= await pdfResult.getText();
       const text=result.text;
       const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap:100});
       const docs= await splitter.createDocuments([text]);
       await vectorStore.addDocuments(docs);
}


app.use(express.json());

app.get("/",(req,res)=>{
    res.json("Hello World");
})

app.post("/ai", async (req,res)=>{
    const {input}=req.body;
    const docs=await vectorStore.similaritySearch(input,5);
    const context=docs.map((d)=>d.pageContent).join("\n\n");
    const response=await llm.invoke([
        new SystemMessage(`you are a RAG AI Assistant.
            STRICT RULES:
            -Answer only from the context
            -Do not use outside knowledge
            -if answer not found say: "I don't know from uploaded pdf
        Context:${context}
            `),
            new HumanMessage(input)
    ])
    res.status(200).json({ai:response.content})
})

app.listen(port,()=>{
    console.log("App is listening on port no 3000");
})