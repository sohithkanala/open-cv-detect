import { Component, ElementRef, ViewChild } from "@angular/core";
import { BehaviorSubject, Observable, filter, forkJoin, switchMap } from "rxjs";
import { NgOpenCVService } from "./lib/ng-open-cv.service";
import { OpenCVLoadResult } from "./lib/ng-open-cv.models";
import { ImageCroppedEvent, ImageCropperComponent } from "ngx-image-cropper";

declare var cv: any;

export interface Point {
	x: number;
	y: number;
}

export class DocumentScanner {
	detect(source: HTMLImageElement | HTMLCanvasElement): any {}
	crop(source: HTMLImageElement | HTMLCanvasElement, points?: Point[], width?: number, height?: number): any {}
}

@Component({
	selector: "app-root",
	templateUrl: "./app.component.html",
	styleUrls: ["./app.component.scss"],
})
export class AppComponent {
	// Notifies of the ready state of the classifiers load operation
	private classifiersLoaded = new BehaviorSubject<any>(false);
	classifiersLoaded$ = this.classifiersLoaded.asObservable();

	@ViewChild("canvasOutput")
	canvasOutput!: ElementRef;
	imageForCrop: string = "";

	private video!: HTMLVideoElement;
	public loadingModel!: boolean;
	private points!: any;
	private socurceFrame!: any;
	private socurceFrameDuplicate!: any;
	public imageCroppedSuccess = false;

	private croppedImage: string = "";
	public croppedImageDup: string = "";
	public showCropper = false;
	public cropperCoor: any = { x1: 0, y1: 0, x2: 200, y2: 300 };
	private videoProcessId: any;
	private maxBrightness = 30;
	private maxContrast = 30;

	constructor(private ngOpenCVService: NgOpenCVService) {}

	ngOnInit() {
		// Always subscribe to the NgOpenCVService isReady$ observer before using a CV related function to ensure that the OpenCV has been
		// successfully loaded
		this.ngOpenCVService.isReady$
			.pipe(
				// The OpenCV library has been successfully loaded if result.ready === true
				filter((result: OpenCVLoadResult) => result.ready)
			)
			.subscribe(() => {
				// The classifiers have been succesfully loaded
				this.classifiersLoaded.next(true);
				this.webInitCamera();
			});
	}

	public webInitCamera() {
		if (typeof document !== "undefined") {
			this.video = <HTMLVideoElement>document.getElementById("videotag");

			navigator.mediaDevices
				.getUserMedia({
					audio: false,
					video: {
						facingMode: "environment",
					},
				})
				.then((stream) => {
					this.video.srcObject = stream;
					this.video.onloadedmetadata = () => {
						this.video.play();
						this.setupVideo();
					};
				});

			// this.loading = false;
		}
	}

	private clearOutputCanvas() {
		const context = this.canvasOutput.nativeElement.getContext("2d");
		context.clearRect(0, 0, this.canvasOutput.nativeElement.width, this.canvasOutput.nativeElement.height);
	}

	async setupVideo() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: false,
			});
			this.video = <HTMLVideoElement>document.getElementById("videotag");
			this.video.srcObject = stream;
			this.video.play();

			this.video.onloadedmetadata = () => {
				this.initializeOpenCV(this.video);
			};
		} catch (err) {
			console.error("An error occurred while accessing the camera:", err);
		}
	}

	private initializeOpenCV(video: HTMLVideoElement): void {
		const cap = new cv.VideoCapture(video);

		const FPS = 60;

		const videoProcess = () => {
			try {
				this.socurceFrame = new cv.Mat(video.height, video.width, cv.CV_8UC4);
				this.socurceFrameDuplicate = new cv.Mat(video.height, video.width, cv.CV_8UC4);

				cap.read(this.socurceFrame);
				cap.read(this.socurceFrameDuplicate);

				const brightness = 1;
				const contrast = 1;

				// Convert the image to grayscale.
				const gray = new cv.Mat();
				cv.cvtColor(this.socurceFrame, gray, cv.COLOR_RGBA2GRAY);

				// Perform Gaussian blur to remove noise.
				const blur = new cv.Mat();
				cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

				const thresh = new cv.Mat();
				cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

				const contours = new cv.MatVector();
				const hierarchy = new cv.Mat();
				cv.findContours(thresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

				const minCardArea = 5000;
				const maxCardArea = 50000;
				let maxContourIndex = 0;
				let maxArea = 0;
				let rectCoordinates: { topLeft: { x: number; y: number }; bottomRight: { x: number; y: number } }[] = [];

				// Iterate through contours to find the card contour
				for (let i = 0; i < contours.size(); ++i) {
					const contour = contours.get(i);
					const contourArea = cv.contourArea(contour);

					// Check if contour area falls within the specified range
					if (contourArea >= minCardArea && contourArea <= maxCardArea) {
						// Draw rectangle around the contour
						maxArea = contourArea;
						maxContourIndex = i;
						const rect = cv.boundingRect(contour);
						const topLeft = new cv.Point(rect.x, rect.y);
						const bottomRight = new cv.Point(rect.x + rect.width, rect.y + rect.height);
						const color = new cv.Scalar(255, 0, 0, 255);
						cv.rectangle(this.socurceFrame, topLeft, bottomRight, color, 2);
						rectCoordinates.push({ topLeft: { x: rect.x, y: rect.y }, bottomRight: { x: rect.x + rect.width, y: rect.y + rect.height } });

						break;
					}
				}

				// Show the processed image
				// cv.imshow("canvasOutputEdges", thresh);

				cv.imshow("canvasOutput", this.socurceFrame);
				cv.imshow("canvasOutputOriginal", this.socurceFrameDuplicate);
				this.points = rectCoordinates[0];

				this.socurceFrameDuplicate.delete();
				this.socurceFrame.delete();

				// Clean up
				gray.delete();
				blur.delete();
				thresh.delete();
				contours.delete();
				hierarchy.delete();
			} catch (err) {
				console.error(err);
			} finally {
				this.videoProcessId = requestAnimationFrame(videoProcess);
			}
		};

		this.videoProcessId = requestAnimationFrame(videoProcess);
	}

	public captureImage() {
		const canvasOutput = document.getElementById("canvasOutputOriginal")! as HTMLCanvasElement;
		this.imageForCrop = canvasOutput.toDataURL();
	}

	public imageCropped(event: ImageCroppedEvent): void {
		const reader = new FileReader();
		reader.onload = async () => {
			this.croppedImage = reader.result as string;
		};
		reader.readAsDataURL(event.blob!);
	}

	public imageLoaded(): void {
		this.showCropper = true;
		cancelAnimationFrame(this.videoProcessId);
	}

	public cropperReady(event: any): void {
		setTimeout(() => {
			this.cropperCoor = { x1: this.points.topLeft.x, y1: this.points.topLeft.y, x2: this.points.bottomRight.x, y2: this.points.bottomRight.y };
		}, 2);
	}

	public loadImageFailed(): void {
		console.log("Load failed");
	}

	private async applyBrightnessContrast(input_img: string, brightness = 0, contrast = 0): Promise<string> {
		let image = new Image();
		image.src = input_img;
		await new Promise((r) => {
			image.onload = r;
		});

		const imgData = cv.imread(image);
		let buf = new cv.Mat();

		imgData.copyTo(buf);
		let shadow;
		let highlight;

		if (brightness != 0) {
			let alpha_b, gamma_b;
			if (brightness > 0) {
				shadow = brightness;
				highlight = 255;
			} else {
				shadow = 0;
				highlight = 255 + brightness;
			}
			alpha_b = (highlight - shadow) / 255;
			gamma_b = shadow;
			cv.addWeighted(imgData, alpha_b, imgData, 0, gamma_b, buf);
		}

		if (contrast != 0) {
			let f = (131 * (contrast + 127)) / (127 * (131 - contrast));
			let alpha_c = f;
			let gamma_c = 127 * (1 - f);
			cv.addWeighted(buf, alpha_c, buf, 0, gamma_c, buf);
		}

		const imgData1 = new ImageData(new Uint8ClampedArray(buf.data), buf.cols, buf.rows);
		const canvas = document.createElement("canvas");
		var ctx = canvas.getContext("2d");
		ctx!.clearRect(0, 0, canvas.width, canvas.height);
		canvas.width = imgData1.width;
		canvas.height = imgData1.height;
		ctx!.putImageData(imgData1, 0, 0);

		// Clean up
		imgData.delete();
		buf.delete();
		return canvas.toDataURL();
	}

	public async cropImage(): Promise<void> {
		this.croppedImageDup = await this.applyBrightnessContrast(this.croppedImage, this.maxBrightness, this.maxContrast);
		this.imageCroppedSuccess = true;
	}
}
