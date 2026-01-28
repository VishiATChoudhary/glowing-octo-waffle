import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
}

export function ButtonColorful({
    className,
    label = "Explore Components",
    ...props
}: ButtonColorfulProps) {
    return (
        <Button
            className={cn(
                "relative h-10 px-4 overflow-hidden",
                "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500",
                "hover:from-yellow-300 hover:via-yellow-400 hover:to-amber-400",
                "transition-all duration-200",
                "group",
                className
            )}
            {...props}
        >
            {/* Content */}
            <div className="relative flex items-center justify-center gap-2">
                <span className="text-zinc-900 font-medium">{label}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-900/90" />
            </div>
        </Button>
    );
}

export { ButtonColorful as default };
