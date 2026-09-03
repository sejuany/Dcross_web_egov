import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import html2pdf from "html2pdf.js";
import ReceiptContent from "./ReceiptContent";
import "../../styles/WaReceipt.css";

const fetchJson = async (url, signal) => {
	const response = await fetch(url, { signal });

	if (!response.ok) {
		throw new Error(`영수증 조회에 실패했습니다. (${response.status})`);
	}

	return response.json();
};

const WaPaymentReceipt = () => {
	const { serviceId } = useParams();
	const [receiptData, setReceiptData] = useState(null);
	const [bondInfo, setBondInfo] = useState({});
	const [bankCodes, setBankCodes] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	useEffect(() => {
		const controller = new AbortController();

		const loadReceipt = async () => {
			if (!serviceId) {
				setError("접수번호가 없습니다.");
				setLoading(false);
				return;
			}

			setLoading(true);
			setError("");

			try {
				const encodedServiceId = encodeURIComponent(serviceId);
				const [detailResult, bondResult, bankCodeResult] =
					await Promise.allSettled([
						fetchJson(
							`/api/newcar/detail/${encodedServiceId}`,
							controller.signal,
						),

						fetchJson(
							`/api/newcar/bond-info/${encodedServiceId}`,
							controller.signal,
						),

						fetchJson("/api/codes/BANK", controller.signal),
					]);

				if (detailResult.status === "rejected") {
					throw detailResult.reason;
				}

				const detailResponse = detailResult.value;

				if (!detailResponse.success || !detailResponse.data) {
					throw new Error(detailResponse.message || "영수증 정보가 없습니다.");
				}

				setReceiptData(detailResponse.data);

				if (
					bondResult.status === "fulfilled" &&
					bondResult.value.success !== false
				) {
					setBondInfo(bondResult.value.data || {});
				} else {
					setBondInfo({});

					console.error(
						"채권정보 조회 실패",
						bondResult.reason || bondResult.value?.message,
					);
				}

				if (
					bankCodeResult.status === "fulfilled" &&
					bankCodeResult.value.success !== false
				) {
					setBankCodes(
						Array.isArray(bankCodeResult.value.codes)
							? bankCodeResult.value.codes
							: [],
					);
				} else {
					setBankCodes([]);
				}
			} catch (loadError) {
				if (loadError.name !== "AbortError") {
					console.error("채권 영수증 조회 실패", loadError);

					setError(loadError.message || "영수증 정보를 불러오지 못했습니다.");
				}
			} finally {
				if (!controller.signal.aborted) {
					setLoading(false);
				}
			}
		};

		loadReceipt();

		return () => controller.abort();
	}, [serviceId]);

	const handleDownloadPdf = async () => {
		const element = document.querySelector(".wa-payment-receipt-pdf");

		if (!element) {
			return;
		}

		const dsService = receiptData?.dsService || {};
		const dsNewCar = receiptData?.dsNewCar || {};
		const worker = html2pdf()
			.set({
				margin: [5, 5, 5, 5],

				filename: `${dsNewCar.CAR_NO || dsNewCar.REQ_CAR_NO || dsService.SERVICE_ID
					}_납부영수증.pdf`,

				image: {
					type: "jpeg",
					quality: 0.98,
				},

				html2canvas: {
					scale: 2,
					useCORS: true,
				},

				jsPDF: {
					unit: "mm",
					format: "a4",
					orientation: "portrait",
				},
			})
			.from(element)
			.toCanvas()
			.then(function fitReceiptToSinglePage() {
				const sourceCanvas = this.prop.canvas;

				const pageRatio = this.prop.pageSize?.inner?.ratio || 287 / 200;

				const singlePageHeight = Math.floor(sourceCanvas.width * pageRatio);

				if (sourceCanvas.height <= singlePageHeight) {
					return;
				}

				const fittedCanvas = document.createElement("canvas");

				const context = fittedCanvas.getContext("2d");

				const scale = singlePageHeight / sourceCanvas.height;

				const fittedWidth = Math.floor(sourceCanvas.width * scale);

				const offsetX = Math.floor((sourceCanvas.width - fittedWidth) / 2);

				fittedCanvas.width = sourceCanvas.width;

				fittedCanvas.height = singlePageHeight;

				context.fillStyle = "#fff";

				context.fillRect(0, 0, fittedCanvas.width, fittedCanvas.height);

				context.drawImage(
					sourceCanvas,
					0,
					0,
					sourceCanvas.width,
					sourceCanvas.height,
					offsetX,
					0,
					fittedWidth,
					singlePageHeight,
				);

				this.prop.canvas = fittedCanvas;
			});

		await worker.toPdf().save();
	};

	const handlePrint = () => window.print();

	if (loading || error || !receiptData) {
		return (
			<div className="wa-payment-receipt-wrapper">
				<div
					className={
						`wa-payment-receipt-page ` +
						`wa-payment-receipt-status ` +
						`${error ? "wa-payment-receipt-status-error" : ""}`
					}
				>
					{error ||
						(loading
							? "영수증 정보를 불러오는 중입니다."
							: "영수증 정보가 없습니다.")}
				</div>
			</div>
		);
	}

	return (
		<div className="wa-payment-receipt-wrapper">
			<ReceiptContent
				receiptData={receiptData}
				bondInfo={bondInfo}
				bankCodes={bankCodes}
				showActions
				onDownloadPdf={handleDownloadPdf}
				onPrint={handlePrint}
			/>
		</div>
	);
};

export default WaPaymentReceipt;
