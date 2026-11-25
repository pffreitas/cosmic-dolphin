"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowUpRight, Bookmark, Check, FileChartColumn, Film, Headphones, Image as ImageIcon, Library, Search } from "lucide-react";
import { CosmicBrief } from "@/components/bookmark/detail/cosmic-brief";
import { LibraryRow } from "@/components/bookmark/library-row";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { Input } from "@/components/ui/input";
import { trackLandingEvent } from "./landing-analytics";
import styles from "./landing.module.css";

const source = "https://science.nasa.gov/earth/earth-observatory/earthrise-revisited-82693/";
const visualSource = "https://svs.gsfc.nasa.gov/4129/";
const photo = "/reading/earthrise.webp";
const title = "Earthrise revisited";
const takeaway = "Earth appeared to rise because Apollo 8 was moving around the Moon. A turn of the spacecraft brought the view into the crew’s window.";
const transcript = "Earthrise looks like a sunrise on Earth. But it was Apollo Eight’s motion that brought Earth into view. On their fourth orbit of the Moon, the crew turned, and Bill Anders caught the moment on color film. Decades later, NASA matched the mountains in the photographs to lunar maps, tracing the picture back to the place it was taken.";

export function SampleSave() {
  const [saved, setSaved] = useState(false);
  const [read, setRead] = useState(false);
  return (
    <div id="sample" className={styles.sample}>
      <div className={styles.sampleBar}><span><Bookmark size={16} aria-hidden /> Sample save</span><span>NASA Earth Observatory</span></div>
      <div className={styles.sheet}>
        <h3>{title}</h3>
        {saved ? (
          <CosmicBrief summary={takeaway} keyPoints={["The photograph was taken during the crew’s fourth lunar orbit.", "Matching the craters in the photos to lunar maps let NASA reconstruct the spacecraft’s position."]} domain="science.nasa.gov" sourceUrl={source} />
        ) : (
          <>
            <p className={styles.teaser}>How did NASA pinpoint where an astronaut took a photograph 45 years earlier?</p>
            <Button variant="primary" className="min-h-11" onClick={() => {
              setSaved(true);
              trackLandingEvent("landing_sample_open");
            }}><Bookmark aria-hidden /> Save &amp; open brief</Button>
          </>
        )}
        {saved && <Button variant="ghost" className="mt-3 min-h-11" aria-pressed={read} onClick={() => {
          setRead(!read);
          if (!read) trackLandingEvent("landing_sample_read");
        }}><Check aria-hidden />{read ? "Marked as read" : "Mark as read"}</Button>}
        <span className="sr-only" role="status">{saved ? "Sample saved. Cosmic brief available." : ""}</span>
      </div>
    </div>
  );
}

const searchTerms = "earthrise revisited nasa apollo 8 eight moon lunar earth space exploration bill anders astronaut astronauts picture photo photograph photography orbit maps craters spacecraft horizon";

export function SampleLibrary() {
  const [query, setQuery] = useState("photo from the Moon");
  const queryEdited = useRef(false);
  const words = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const match = words.length === 0 || words.some(word => searchTerms.split(" ").includes(word));
  return (
    <div className={styles.searchBox}>
      <div className={styles.sampleBar}><span><Library size={16} aria-hidden /> Sample library</span><span>1 save</span></div>
      <div className={styles.searchField}>
        <Search size={17} aria-hidden />
        <Input aria-label="Search the sample library" type="search" value={query} onChange={event => {
          queryEdited.current = true;
          setQuery(event.target.value);
        }} onBlur={() => {
          if (queryEdited.current && query.trim()) trackLandingEvent("landing_library_search", { result_count: Number(match) });
          queryEdited.current = false;
        }} placeholder="Search by an idea or title" />
      </div>
      <span className="sr-only" role="status">{match ? "1 matching save" : "No matching saves"}</span>
      {match ? <LibraryRow title={title} href={source} summary="Reconstructing the Apollo 8 photograph from lunar maps and the crew’s film." collectionPath={[{id:"space", name:"Space & exploration"}]} domain="science.nasa.gov" thumbnailUrl={photo} className="px-5 pb-6" /> :
        <div className={styles.empty}><p>No sample saves match that search.</p><Button variant="link" onClick={() => setQuery("Moon")}>Try “Moon”</Button></div>}
    </div>
  );
}

const formats = [
  { name: "Visual", Icon: ImageIcon },
  { name: "Audio", Icon: Headphones },
  { name: "Short video", Icon: Film },
  { name: "Infographic", Icon: FileChartColumn },
] as const;
type Format = typeof formats[number]["name"];

export function FormatStudio() {
  const [format, setFormat] = useState<Format>("Visual");
  return (
    <div className={styles.formatStudio}>
      <div role="group" aria-label="Choose a sample format" className={styles.switcher}>
        {formats.map(({name, Icon}) => (
          <Button key={name} variant="ghost" aria-pressed={format === name} aria-controls="format-preview" onClick={() => {
            if (name !== format) {
              setFormat(name);
              trackLandingEvent("landing_format_select", { sample_format: name.toLowerCase().replace(" ", "_") });
            }
          }}>
            <Icon aria-hidden />{name}
          </Button>
        ))}
      </div>
      <div id="format-preview" className={styles.formatStage}>
        {format === "Visual" && (
          <div className={styles.visual}>
            <h3>The same view, 45 years apart.</h3>
            <p>Compare Anders’s photograph with NASA’s reconstruction. The lunar horizon helped pinpoint the view from Apollo 8.</p>
            <div className={styles.photoPair}>
              <figure><Image src="/reading/earthrise-1968.webp" width={870} height={580} alt="Earth meets the lunar horizon in Anders’s black-and-white photograph." /><figcaption>1968 <span>Bill Anders / NASA</span></figcaption></figure>
              <figure><Image src="/reading/earthrise-2013.webp" width={870} height={489} alt="Earth at the same horizon in NASA’s reconstruction from lunar terrain data." /><figcaption>2013 <span>NASA Scientific Visualization Studio</span></figcaption></figure>
            </div>
          </div>
        )}
        {format === "Audio" && (
          <div className={styles.audio}>
            <Image src="/reading/earthrise-wave.webp" width={1000} height={140} alt="" />
            <h3>The Earthrise audio brief</h3>
            <audio onPlay={() => trackLandingEvent("landing_media_play", { sample_format: "audio" })} controls preload="metadata" aria-label="Play the Earthrise audio brief" src="/reading/earthrise-audio.mp3" />
            <details><summary className={focusRing}>Read transcript</summary><p>{transcript}</p></details>
          </div>
        )}
        {format === "Short video" && (
          <div className={styles.movie}>
            <video onPlay={() => trackLandingEvent("landing_media_play", { sample_format: "short_video" })} playsInline controls preload="metadata" poster="/reading/earthrise-video-poster.webp" aria-label="How Apollo 8 saw Earthrise">
              <source src="/reading/earthrise-film.mp4" type="video/mp4" />
              <track kind="captions" src="/reading/earthrise-en.vtt" srcLang="en" label="English" default />
            </video>
          </div>
        )}
        {format === "Infographic" && (
          <div className={styles.graphic}>
            <h3>Reconstructing Earthrise</h3>
            <ol>
              <li><b>4th orbit</b><span>The photograph</span><p>Bill Anders photographs Earth on Apollo 8’s fourth lunar orbit.</p></li>
              <li><b>20 sec</b><span>The clue</span><p>A second camera automatically photographs the lunar terrain every 20 seconds.</p></li>
              <li><b>45 years</b><span>The reconstruction</span><p>Decades later, NASA matches those frames to lunar maps to locate the spacecraft.</p></li>
            </ol>
          </div>
        )}
      </div>
      <div className={styles.formatNotes}>
        <p>Format previews for this sample. Your library currently creates written briefs.</p>
        <Button variant="link" asChild><a href={format === "Short video" ? visualSource : source} target="_blank" rel="noreferrer">NASA {format === "Short video" ? "visualization" : "source"} <ArrowUpRight aria-hidden /></a></Button>
      </div>
    </div>
  );
}
