import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GifResult, useGifSearch } from "@/hooks/use-gif-search";
import useRetro from "@/hooks/use-retro";
import { cn } from "@/lib/utils";
import { ImageOff, Link2, SearchIcon, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function GIFDialog({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: (url: string) => void;
}) {
  const {
    retro: { gif_search_enabled },
  } = useRetro();

  const [open, setOpen] = useState(false);

  function handleSelect(url: string) {
    setOpen(false);
    onSelect(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add an image</DialogTitle>
          <DialogDescription>
            {gif_search_enabled
              ? "Search for a GIF, or paste a link to any image."
              : "Paste a link to any image or GIF."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={gif_search_enabled ? "search" : "link"}>
          <TabsList className="w-full">
            <TabsTrigger value="search" disabled={!gif_search_enabled}>
              <SearchIcon />
              Search
            </TabsTrigger>
            <TabsTrigger value="link">
              <Link2 />
              Paste link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search">
            {/* Mounted only while visible so trending is not fetched for
                someone who only ever pastes links. */}
            {gif_search_enabled && <SearchTab onSelect={handleSelect} />}
          </TabsContent>

          <TabsContent value="link">
            <LinkTab onSelect={handleSelect} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SearchTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const { results, status, hasNext, loadMore } = useGifSearch(query, true);

  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !hasNext) return;

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && loadMore(),
      { rootMargin: "200px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasNext, loadMore]);

  const isFirstLoad = status === "loading";

  return (
    <div className="space-y-3">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="dancing cat"
        aria-label="Search for a GIF"
      />

      <div className="h-96 overflow-y-auto rounded-md">
        {status === "error" && (
          <Empty
            icon={<ImageOff className="size-5" />}
            title="Couldn't reach the GIF service"
            body="Try again in a moment, or paste a link instead."
          />
        )}

        {isFirstLoad && <TileSkeletons />}

        {status !== "error" && !isFirstLoad && results.length === 0 && (
          <Empty
            icon={<SearchX className="size-5" />}
            title={query.trim() ? `No GIFs for "${query.trim()}"` : "Nothing to show"}
            body="Try a different search."
          />
        )}

        {!isFirstLoad && results.length > 0 && (
          <>
            <div className="columns-3 gap-2 [&>*]:mb-2">
              {results.map((result, i) => (
                <Tile
                  key={`${result.url}-${i}`}
                  result={result}
                  onSelect={() => onSelect(result.url)}
                />
              ))}
            </div>

            <div ref={sentinel} className="flex h-10 items-center justify-center">
              {status === "loading-more" && <Spinner className="text-muted-foreground" />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({
  result,
  onSelect,
}: {
  result: GifResult;
  onSelect: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  // Reserve the tile's space up front so the grid does not reflow as images
  // stream in. Providers do not always report dimensions, so fall back square.
  const aspectRatio =
    result.width && result.height ? result.width / result.height : 1;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative block w-full overflow-hidden rounded-md ring-2 ring-transparent transition-all duration-150 hover:ring-primary focus-visible:ring-primary focus-visible:outline-none"
      style={{ aspectRatio }}
    >
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}

      <img
        src={result.preview_url}
        alt=""
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-all duration-200 group-hover:scale-105",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </button>
  );
}

function TileSkeletons() {
  // Uneven heights so the placeholder reads as a masonry grid, not a table.
  const heights = [140, 96, 120, 108, 152, 88, 116, 132, 100];

  return (
    <div className="columns-3 gap-2 [&>*]:mb-2">
      {heights.map((height, i) => (
        <div
          key={i}
          className="animate-pulse rounded-md bg-muted"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function LinkTab({ onSelect }: { onSelect: (url: string) => void }) {
  const [value, setValue] = useState("");
  const [broken, setBroken] = useState(false);

  const url = value.trim();
  const looksValid = /^https:\/\/\S+$/i.test(url);
  const canUse = looksValid && !broken;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canUse) onSelect(url);
      }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setBroken(false);
        }}
        placeholder="https://media.giphy.com/…"
        aria-label="Image URL"
      />

      <p className="text-xs text-muted-foreground">
        Any https image or GIF link works. Right-click an image anywhere and
        copy its address.
      </p>

      <div className="flex h-64 items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/30">
        {!looksValid && (
          <p className="text-sm text-muted-foreground">Preview appears here</p>
        )}

        {looksValid && broken && (
          <p className="text-sm text-muted-foreground">
            That link didn't load as an image
          </p>
        )}

        {looksValid && (
          <img
            src={url}
            alt=""
            onError={() => setBroken(true)}
            className={cn("max-h-full max-w-full object-contain", broken && "hidden")}
          />
        )}
      </div>

      <Button type="submit" className="w-full" disabled={!canUse}>
        Use this image
      </Button>
    </form>
  );
}

function Empty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs">{body}</p>
    </div>
  );
}
