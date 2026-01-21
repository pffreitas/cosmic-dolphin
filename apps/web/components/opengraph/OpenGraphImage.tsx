interface OpenGraphImageProps {
  imageUrl: string;
  title: string;
  description: string;
  onClick?: () => void;
}

export default function OpenGraphImage({
  imageUrl,
  title,
  description,
  onClick,
}: OpenGraphImageProps) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="max-w-full flex flex-col md:flex-row gap-4 rounded-lg">
      <img
        src={imageUrl}
        alt={description || "Image"}
        className="h-48 md:h-60 object-contain cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onClick}
      />
      <h4 className="text-sm font-medium text-gray-900 mb-1 leading-tight">
        {title}
      </h4>
      <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
