import { Card, Skeleton } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

import { InfoTooltip } from "components/InfoTooltip/InfoTooltip";

import styles from "./AuditPage.module.css";

/**
 * One number of the summary: a dimmed label (with an optional explanation), the value itself,
 * and a footnote for the caveat that would otherwise have to live in the label. While
 * `loading`, both are skeletons — a "$0" before the data is in would read as a real figure.
 * While `settling`, the value is real but still growing: it is dimmed and the footnote gets a
 * spinner, so the two cues say the same thing — this number will still change.
 */
export const SummaryCard = ({ title, tooltip, value, footnote, loading, settling }) => (
  <Card bordered className={styles.card} bodyStyle={{ padding: 16 }}>
    <div className={styles.cardTitle}>
      {title}{tooltip && <> <InfoTooltip title={tooltip} /></>}
    </div>
    {/* the skeleton boxes take the block's own line height, so the card is the same size either way */}
    <div className={styles.cardValue} style={settling ? { opacity: .6 } : undefined}>
      {loading
        ? <div className={styles.cardValueSkeleton}><Skeleton.Input active size="small" style={{ width: 140, height: 24 }} /></div>
        : value}
    </div>
    <div className={styles.cardFootnote}>
      {loading
        ? <div className={styles.cardFootnoteSkeleton}><Skeleton.Input active size="small" style={{ width: 180, height: 10 }} /></div>
        : <>{settling && <LoadingOutlined spin style={{ marginRight: 6 }} />}{footnote}</>}
    </div>
  </Card>
);
