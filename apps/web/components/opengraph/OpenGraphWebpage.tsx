import { ExternalLinkIcon } from "lucide-react";

interface OpenGraphWebpageProps {
  title: string;
  description: string;
  image: string;
  url: string;
}

export default function OpenGraphWebpage({
  title,
  description,
  image,
  url,
}: OpenGraphWebpageProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col md:flex-row text-inherit no-underline select-none transition-all duration-75 ease-in-out cursor-pointer w-full items-stretch text-left overflow-hidden border border-white/13 rounded-[10px] relative hover:bg-white/5"
    >
      {/* Image Section - Shows first on mobile, second on desktop */}
      {image && (
        <div className="w-full h-48 md:h-auto md:flex-[1_1_180px] md:order-2 block relative">
          <div className="absolute inset-0">
            <div className="w-full h-full">
              <img
                src={image}
                alt={title || ""}
                className="block object-cover w-full h-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Text Content Section - Shows second on mobile, first on desktop */}
      <div className="flex-1 md:flex-[4_1_180px] md:order-1 p-3 pb-[14px] min-w-0 text-left">
        {/* Title with Favicon and External Link Icon */}
        <div className="flex items-start gap-2 mb-2">
          {image && (
            <img
              src={image}
              alt=""
              className="w-4 h-4 min-w-4 rounded-sm flex-shrink-0"
            />
          )}
          <div className="text-sm leading-5 text-white/81 line-clamp-2">
            {title}
          </div>
          <ExternalLinkIcon className="w-3 h-3 min-w-4 text-white/46 flex-shrink-0 " />
        </div>

        {/* Description */}
        <div className="text-xs leading-4 text-white/46 line-clamp-2 mb-1.5">
          {description}
        </div>
      </div>
    </a>
  );
}
