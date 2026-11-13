import type { Block } from '../../lib/types';
import { CardsBlock } from './Cards';
import { EvidenceBlock, OwnerReports, LiveReviews, TopicBoard } from './Evidence';
import { CompareBlock, TeamPlan, SellPlan, MyLaptopsBlock, MarketPulse, BrandInsights } from './Tables';
import { Notice, TextBlock, Choices, Offer, Understood, Findings, Checklist, Claims, Receipt, FormRequest, Unknown, ImageRead, Provenance, WhereToBuy, DataStatus } from './Misc';
import { LaptopAnswer } from './LaptopAnswer';
import { AskLaptop } from './AskLaptop';
import { WebLaptop } from './WebLaptop';

/** One component per backend block type. An unknown type is mentioned, never a crash. */
export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'web_laptop': return <WebLaptop b={block} />;
    case 'notice': return <Notice b={block} />;
    case 'text': return <TextBlock b={block} />;
    case 'choices': return <Choices b={block} />;
    case 'ask_laptop': return <AskLaptop b={block} />;
    case 'offer': return <Offer b={block} />;
    case 'understood': return <Understood b={block} />;
    case 'cards': return <CardsBlock b={block} />;
    case 'evidence': return <EvidenceBlock b={block} />;
    case 'owner_reports': return <OwnerReports b={block} />;
    case 'live_reviews': return <LiveReviews b={block} />;
    case 'topic_board': return <TopicBoard b={block} />;
    case 'compare': return <CompareBlock b={block} />;
    case 'claims': return <Claims b={block} />;
    case 'findings': return <Findings b={block} />;
    case 'checklist': return <Checklist b={block} />;
    case 'team_plan': return <TeamPlan b={block} />;
    case 'sell_plan': return <SellPlan b={block} />;
    case 'my_laptops': return <MyLaptopsBlock b={block} />;
    case 'market_pulse': return <MarketPulse b={block} />;
    case 'brand_insights': return <BrandInsights b={block} />;
    case 'report_receipt': return <Receipt b={block} />;
    case 'form_request': return <FormRequest b={block} />;
    case 'image_read': return <ImageRead b={block} />;
    case 'provenance': return <Provenance b={block} />;
    case 'where_to_buy': return <WhereToBuy b={block} />;
    case 'data_status': return <DataStatus b={block} />;
    case 'laptop_answer': return <LaptopAnswer b={block} />;
    case 'ack': case 'catalog': return null;
    default: return <Unknown b={block} />;
  }
}
