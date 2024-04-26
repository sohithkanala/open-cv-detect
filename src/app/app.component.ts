import { Component, ElementRef, ViewChild } from "@angular/core";
import { BehaviorSubject, Observable, filter, forkJoin, switchMap } from "rxjs";
import { NgOpenCVService } from "./lib/ng-open-cv.service";
import { OpenCVLoadResult } from "./lib/ng-open-cv.models";

declare var cv: any;

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

	private video!: HTMLVideoElement;
	public innerWidth: any = 600;
	public innerHeight: any = 600;
	public loadingModel!: boolean;

	// Inject the NgOpenCVService
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

	clearOutputCanvas() {
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

	initializeOpenCV(video: HTMLVideoElement) {
		const cap = new cv.VideoCapture(video);

		const FPS = 60;
		const canvas = <HTMLCanvasElement>document.getElementById("canvasOutput");

		const processVideo = () => {
			try {
				const src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
				// const dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);

				cap.read(src);

				// Convert the image to grayscale.
				const gray = new cv.Mat();
				cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

				// Perform Gaussian blur to remove noise.
				const blur = new cv.Mat();
				cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

				const thresh = new cv.Mat();
				cv.threshold(blur, thresh, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

				const contours = new cv.MatVector();
				const hierarchy = new cv.Mat();
				cv.findContours(thresh, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

				const minCardArea = 5000; // Adjust this value as needed
				const maxCardArea = 50000; // Adjust this value as needed

				// Iterate through contours to find the card contour
				for (let i = 0; i < contours.size(); ++i) {
					const contour = contours.get(i);
					const contourArea = cv.contourArea(contour);
					console.log("Contour area:", contourArea); // Debugging: Print contour areas

					// Check if contour area falls within the specified range
					if (contourArea >= minCardArea && contourArea <= maxCardArea) {
						// Draw rectangle around the contour
						const rect = cv.boundingRect(contour);
						const topLeft = new cv.Point(rect.x, rect.y);
						const bottomRight = new cv.Point(rect.x + rect.width, rect.y + rect.height);
						const color = new cv.Scalar(255, 0, 0, 255);
						cv.rectangle(src, topLeft, bottomRight, color, 2);
						break; // Break after finding the first suitable contour
					}
				}

				// Show the processed image
				// cv.imshow("canvasOutputEdges", thresh);
				cv.imshow("canvasOutput", src);

				// Clean up
				src.delete();
				gray.delete();
				blur.delete();
				thresh.delete();
				contours.delete();
				hierarchy.delete();
			} catch (err) {
				console.error(err);
			} finally {
				setTimeout(processVideo, 1000 / FPS);
			}
		};

		processVideo();
	}
}
