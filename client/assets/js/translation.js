document.addEventListener('DOMContentLoaded', async () => {
  const targetLanguage = new URLSearchParams(window.location.search).get('targetLang') || 'fr';
  const originalTextElement = document.getElementById('aiGeneratedText');
  
  // API'den metin üret
  async function fetchGeneratedText() {
    try {
      const response = await fetch('http://localhost:3000/generate-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          targetLanguage: targetLanguage === 'fr' ? 'French' : 'Spanish' 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.text;
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('API Hatası:', error);
      return "API bağlantı hatası - Lütfen konsolu kontrol edin";
    }
  }

  // Metni yükle ve göster
  const generatedText = await fetchGeneratedText();
  originalTextElement.textContent = generatedText;

  // ... (önceki çeviri işlemleri burada kalacak)
});