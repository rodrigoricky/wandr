import Image from "next/image";
import { Footprints, Plane } from "lucide-react";
import type { ReactNode } from "react";
import type { ProviderId } from "@wandr/shared";
import { providerMetadata } from "@wandr/shared";
import { JeepneyIcon } from "./JeepneyIcon";

const iconFor: Record<ProviderId, ReactNode> = {
  walk: <Footprints size={20} aria-hidden="true"/>,
  jeepney: <JeepneyIcon/>,
  grab_taxi: null,
  green_gsm_taxi: null,
  maxim_motorcycle: null,
  philippine_airlines: null,
  cebu_pacific: null,
  generic_air: <Plane size={20} aria-hidden="true"/>,
};

export function ProviderIdentity({ providerId }: { providerId: ProviderId }) {
  const provider = providerMetadata[providerId];
  return <span className={`provider-identity provider-identity-${providerId}`} data-provider-id={providerId}>
    <span className={`provider-mark provider-mark-${providerId}`} style={{ backgroundColor: provider.accent }}>
      {provider.localSvgPath ? <Image className={`provider-logo provider-logo-${providerId}`} src={provider.localSvgPath} alt={`${provider.name} logo`} width={120} height={48} unoptimized/> : <span aria-hidden="true">{iconFor[providerId]}</span>}
    </span>
    <span className="provider-name">{provider.name}</span>
  </span>;
}
