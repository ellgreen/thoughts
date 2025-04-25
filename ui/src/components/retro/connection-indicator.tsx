import { PayloadConnectionInfo } from "@/events";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "../ui/button";
import { User, Zap } from "lucide-react";

export default function ConnectionIndicator({
  connectionInfo,
  readyState,
}: {
  connectionInfo: PayloadConnectionInfo;
  readyState: number;
}) {
  const [state, stateClassName] = {
    0: ["Connecting", "text-yellow-500"],
    1: ["Connected", "text-green-500"],
    2: ["Disconnecting", "text-yellow-500"],
    3: ["Disconnected", "text-red-500"],
  }[readyState] || ["Unknown", "text-red-500"];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <span>{state}</span>
          <Zap className={stateClassName} />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {connectionInfo.users.length === 0 ? (
          <div className="text-center text-muted-foreground">
            No users connected
          </div>
        ) : (
          <ul className="space-y-3">
            {connectionInfo.users.map((user) => (
              <li key={user} className="flex items-center space-x-2">
                <User className="size-4 text-muted-foreground" />
                <span>{user}</span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
