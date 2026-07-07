const DEEPL_FREE_ENDPOINT = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_ENDPOINT = "https://api.deepl.com/v2/translate";

function getDeepLEndpoint(apiKey) {
  if (process.env.DEEPL_API_URL) {
    return process.env.DEEPL_API_URL;
  }

  return String(apiKey || "").endsWith(":fx") ? DEEPL_FREE_ENDPOINT : DEEPL_PRO_ENDPOINT;
}

export async function translateTextWithDeepL(text, { sourceLang, targetLang } = {}) {
  const cleanText = String(text || "").trim();
  const apiKey = process.env.DEEPL_API_KEY;

  if (!cleanText || !apiKey) {
    return "";
  }

  const response = await fetch(getDeepLEndpoint(apiKey), {
    body: JSON.stringify({
      preserve_formatting: true,
      source_lang: sourceLang,
      target_lang: targetLang,
      text: [cleanText],
    }),
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`DeepL retornou status ${response.status}.`);
  }

  const payload = await response.json();
  return String(payload?.translations?.[0]?.text || "").trim();
}

export async function fillMissingBiographyTranslation(data) {
  const nextData = { ...data };

  try {
    if (nextData.bio && !nextData.bioEn) {
      nextData.bioEn = await translateTextWithDeepL(nextData.bio, {
        sourceLang: "PT",
        targetLang: "EN-US",
      });
    }

    if (nextData.bioEn && !nextData.bio) {
      nextData.bio = await translateTextWithDeepL(nextData.bioEn, {
        sourceLang: "EN",
        targetLang: "PT-BR",
      });
    }
  } catch (error) {
    console.warn("Nao foi possivel traduzir a biografia com DeepL.", error);
  }

  return nextData;
}

async function fillMissingTranslatedField(nextData, sourceKey, targetKey, sourceLang, targetLang) {
  if (nextData[sourceKey] && !nextData[targetKey]) {
    nextData[targetKey] = await translateTextWithDeepL(nextData[sourceKey], {
      sourceLang,
      targetLang,
    });
  }
}

export async function fillMissingProjectTranslation(data) {
  const nextData = { ...data };

  try {
    await fillMissingTranslatedField(nextData, "title", "titleEn", "PT", "EN-US");
    await fillMissingTranslatedField(nextData, "subtitle", "subtitleEn", "PT", "EN-US");
    await fillMissingTranslatedField(nextData, "description", "descriptionEn", "PT", "EN-US");
    await fillMissingTranslatedField(nextData, "titleEn", "title", "EN", "PT-BR");
    await fillMissingTranslatedField(nextData, "subtitleEn", "subtitle", "EN", "PT-BR");
    await fillMissingTranslatedField(nextData, "descriptionEn", "description", "EN", "PT-BR");
  } catch (error) {
    console.warn("Nao foi possivel traduzir o projeto com DeepL.", error);
  }

  return nextData;
}
