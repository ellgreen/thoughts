import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Route as RetrosRoute } from "@/routes/_auth.retros.$retroId";
import { Retro } from "@/types";
import { Link } from "@tanstack/react-router";

export default function List({ retros }: { retros?: Retro[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Retros</CardTitle>
      </CardHeader>

      <CardContent>
        {!retros || retros.length === 0 ? (
          <p className="text-foreground">No retros found 😢</p>
        ) : (
          <ul className="space-y-2">
            {retros.map((retro) => (
              <RetroItem key={retro.id} retro={retro} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RetroItem({ retro }: { retro: Retro }) {
  return (
    <li>
      <Link to={RetrosRoute.path} params={{ retroId: retro.id }}>
        <Button className="w-full justify-start" variant="outline">
          {retro.title}
        </Button>
      </Link>
    </li>
  );
}
