import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

/**
 * RelayCare buttons: 44px touch height, 14px continuous corners, press-to-scale feedback
 * (Emil Kowalski: respond instantly, ease out, never bounce), soft top highlight on primary.
 */
const buttonVariants = cva(
  "pressable group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)] hover:bg-[color-mix(in_oklab,var(--primary),black_8%)]",
        outline: "glass text-foreground hover:bg-[var(--glass-strong)] aria-expanded:bg-[var(--glass-strong)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost: "text-foreground hover:bg-accent aria-expanded:bg-accent",
        destructive: "bg-destructive/12 text-destructive hover:bg-destructive/18 focus-visible:ring-destructive/25",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-8 rounded-sm px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 rounded-sm px-3.5",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-xs": "size-8 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-sm",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
