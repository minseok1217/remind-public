// api/gemini.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = window.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

export function getGenerativeModel() {
    return genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
}