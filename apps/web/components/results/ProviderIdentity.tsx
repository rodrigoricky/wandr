import { Bike, CarFront, CarTaxiFront, Footprints, Plane } from "lucide-react";
import type { ReactNode } from "react";
import type { ProviderId } from "@wandr/shared";
import { providerNames } from "@wandr/shared";
import { JeepneyIcon } from "./JeepneyIcon";

const iconFor: Record<ProviderId, ReactNode> = {
  walk: <Footprints size={20} aria-hidden="true"/>,
  jeepney: <JeepneyIcon/>,
  generic_taxi: <CarTaxiFront size={20} aria-hidden="true"/>,
  generic_motorcycle: <Bike size={20} aria-hidden="true"/>,
  generic_car: <CarFront size={20} aria-hidden="true"/>,
  philippine_airlines: <Plane size={20} aria-hidden="true"/>,
  cebu_pacific: <Plane size={20} aria-hidden="true"/>,
  generic_air: <Plane size={20} aria-hidden="true"/>,
};

export function ProviderIdentity({ providerId }: { providerId: ProviderId }) {
  return <span className="provider-identity"><span className={`provider-mark provider-mark-${providerId}`} aria-hidden="true">{iconFor[providerId]}</span><span className="provider-name">{providerNames[providerId]}</span></span>;
}
