export const highlightText = (text: string, query: string) => {
  if (!query.trim()) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();

    return isMatch ? (
      <mark
        key={index}
        className="bg-primary-200 text-foreground font-semibold"
      >
        {part}
      </mark>
    ) : (
      part
    );
  });
};
