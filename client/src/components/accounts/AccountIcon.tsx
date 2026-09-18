import {
  Wallet, Landmark, PiggyBank, Banknote, CreditCard, Briefcase,
  Coins, Gem, Building2, type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  wallet: Wallet,
  bank: Landmark,
  piggy: PiggyBank,
  cash: Banknote,
  card: CreditCard,
  briefcase: Briefcase,
  coins: Coins,
  gem: Gem,
  building: Building2,
};

export function AccountIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = iconMap[icon] ?? Wallet;
  return <Icon className={className} />;
}

export const accountIcons = Object.keys(iconMap);
