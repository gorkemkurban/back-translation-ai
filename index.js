require("dotenv").config();
const readline = require("readline-sync");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// API Anahtarını yükle
const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function translateText(text, targetLanguage) {
    const instruction = "You are a professional translator. Follow these instructions carefully:";
    const prompt = `${instruction}\nTranslate the following text into ${targetLanguage}:\n"${text}"`;

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const response = await result.response;
        console.log(`\nÇevrilen Metin (${targetLanguage}):\n`, response.text());
    } catch (error) {
        console.error("Hata:", error.message);
    }
}

// Kullanıcıdan giriş al
const inputText = readline.question("Çevirmek istediğiniz metni girin: ");
const targetLang = readline.question("Hedef dili girin (örneğin: French, German, Turkish): ");

translateText(inputText, targetLang);
