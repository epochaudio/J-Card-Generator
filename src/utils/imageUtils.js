export const urlToBase64 = async (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error('Network response was not ok');

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Image to Base64 failed, using raw URL.", error);
    return url;
  }
};
