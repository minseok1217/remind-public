// api/gemini.js
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = window.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

export function getGenerativeModel() {
    // 1.5-flash -> 2.5-flash 로 변경
    return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}