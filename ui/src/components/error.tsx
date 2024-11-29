import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

export function Error() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Card>
        <CardHeader>
          <CardTitle>That's unexpected.</CardTitle>
          <CardDescription>
            Something went wrong. Please try again later.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Link to="/">
            <Button className="w-full">Go back home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export function NotFoundError() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Card>
        <CardHeader>
          <CardTitle>We can't find what you are looking for.</CardTitle>
        </CardHeader>

        <CardContent>
          <Link to="/">
            <Button className="w-full">Go back home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
