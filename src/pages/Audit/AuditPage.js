import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Helmet } from "react-helmet-async";
import { BackTop, Button, Col, Row, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import { selectBridgesStatus } from "store/bridgesSlice";
import { selectAuditLastUpdated, selectAuditStatus } from "store/auditSlice";
import { AUDIT_TTL, loadAuditData } from "store/thunks/loadAuditData";
import { formatUsd } from "utils/formatAmount";

import { AuditTable } from "./AuditTable";
import { SummaryCard } from "./SummaryCard";
import { selectAuditTotals } from "./helpers/selectAuditTableRows";
import styles from "./AuditPage.module.css";

const { Title, Paragraph } = Typography;

const UPDATED_AT_TICK = 30 * 1000;

const getUpdatedAgo = (lastUpdated) => {
  if (!lastUpdated) return null;
  const minutes = Math.floor((Date.now() - lastUpdated) / 60000);
  if (minutes < 1) return 'updated just now';
  return `updated ${minutes} min ago`;
}

export const AuditPage = () => {
  const dispatch = useDispatch();
  const bridgesStatus = useSelector(selectBridgesStatus);
  const status = useSelector(selectAuditStatus);
  const lastUpdated = useSelector(selectAuditLastUpdated);
  const { lockedInUsd, issuedInUsd, priced, total } = useSelector(selectAuditTotals);

  const [, setTick] = useState(0);

  // The bridges list is loaded by AppRouter, so it can still be in flight when we mount. This
  // also re-runs on every 5-minute bridges poll, where the TTL turns it into a no-op unless a
  // new bridge showed up.
  useEffect(() => {
    if (bridgesStatus === 'succeeded') dispatch(loadAuditData());
  }, [bridgesStatus]);

  // The refresh has to be forced: the interval and the TTL are the same length, so by the time
  // a tick arrives the previous load is only TTL-minus-its-own-duration old and the TTL would
  // skip every other tick, halving the real refresh rate.
  useEffect(() => {
    const intervalId = setInterval(() => dispatch(loadAuditData({ force: true })), AUDIT_TTL);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => setTick(t => t + 1), UPDATED_AT_TICK);
    return () => clearInterval(intervalId);
  }, []);

  const isLoading = status === 'loading';
  // The first load is the only time the cards have nothing to show. The totals appear as soon
  // as one bridge is priced and keep growing — the Obyte explorer alone can take ~10s, and
  // holding everything back for it would leave the page blank for that long. The count of
  // bridges is known the moment the list is, so that card never waits.
  const isFirstLoad = !lastUpdated && status !== 'failed';
  const totalsPending = isFirstLoad && priced === 0;
  const totalsSettling = isFirstLoad && priced > 0;

  return (
    <div className={styles.audit}>
      <Helmet title="Counterstake Bridge - Audit" />

      <div className={styles.header}>
        <Title level={1} style={{ marginBottom: 10 }}>Bridge audit</Title>

        <div className={styles.refresh}>
          {lastUpdated && <span className={styles.updatedAt}>{getUpdatedAgo(lastUpdated)}</span>}
          <Button
            icon={<ReloadOutlined />}
            loading={isLoading}
            disabled={isLoading || total === 0}
            onClick={() => dispatch(loadAuditData({ force: true }))}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Paragraph style={{ opacity: .8 }}>
        For every bridge: how much of the home asset is held on the export side, and how many image
        tokens exist on the import side.
      </Paragraph>

      <Row gutter={[16, 16]} className={styles.cards}>
        <Col xs={24} sm={8}>
          <SummaryCard
            title="Export balance"
            tooltip="The raw balance held on the export side. It also covers the stakes of open claims and anything sent there directly, so a surplus over the issued amount is expected."
            value={formatUsd(lockedInUsd)}
            footnote={totalsSettling ? `${priced}/${total} bridges in so far` : 'raw balance, stakes included'}
            loading={totalsPending}
            settling={totalsSettling}
          />
        </Col>
        <Col xs={24} sm={8}>
          <SummaryCard
            title="Issued"
            value={formatUsd(issuedInUsd)}
            footnote={totalsSettling ? `${priced}/${total} bridges in so far` : 'image tokens held by users'}
            loading={totalsPending}
            settling={totalsSettling}
          />
        </Col>
        <Col xs={24} sm={8}>
          <SummaryCard
            title="Bridges"
            value={total}
            footnote={isFirstLoad ? 'still loading' : priced === total ? 'all priced' : `${priced} priced — totals cover only those`}
            loading={total === 0}
            settling={isFirstLoad && total > 0}
          />
        </Col>
      </Row>

      <AuditTable />

      <BackTop />
    </div>
  );
}
