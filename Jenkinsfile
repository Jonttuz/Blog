// =====================================================================
//  Blog – secure CI/CD pipeline
//  Security tests:
//    1. OWASP Dependency-Check  (SCA, source phase)
//    2. Trivy filesystem scan    (SCA + secrets + IaC misconfig, source phase)
//    3. Trivy image scan         (container scan, build phase)
//    4. Nikto                    (DAST, test phase)
//  After the tests the application is deployed as container 'blog' (port 3000).
//
//  Prerequisites on the Jenkins VM (see design document):
//    - Docker installed, user 'jenkins' in group 'docker'
//    - Dependency-Check plugin + tool installation named 'dependency-check'
//    - Jenkins credential (Secret text) with ID 'nvd-api-key'
// =====================================================================

pipeline {
    agent any

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')   // first NVD download can be slow
    }

    environment {
        IMAGE_NAME     = 'blog'
        IMAGE_TAG      = "${env.BUILD_NUMBER}"
        APP_PORT       = '3000'              // port the app listens on (EXPOSE 3000)
        TEST_CONTAINER = 'blog-test'
        TEST_PORT      = '3001'              // host port for the temporary test instance
        PROD_CONTAINER = 'blog'
        PROD_PORT      = '3000'              // host port for the deployed application
        REPORT_DIR     = 'reports'
        // Pin these to specific versions for reproducible, trustworthy builds
        TRIVY_IMAGE    = 'aquasec/trivy:latest'
        NIKTO_IMAGE    = 'hackllc/nikto:latest'
    }

    stages {

        // Source code is checked out automatically ("Declarative: Checkout SCM")

        stage('Prepare') {
            steps {
                sh '''
                    rm -rf "$REPORT_DIR"
                    mkdir -p "$REPORT_DIR"
                    chmod 777 "$REPORT_DIR"   # Nikto container runs as a different user
                    docker --version
                '''
            }
        }

        // ---------------- SOURCE PHASE ----------------

        stage('SCA: OWASP Dependency-Check') {
            steps {
                // NVD API key is read from Jenkins Credentials, never stored in Git.
                // Without a key: remove withCredentials and the --nvdApiKey argument.
                withCredentials([string(credentialsId: 'nvd-api-key', variable: 'NVD_API_KEY')]) {
                    dependencyCheck(
                        odcInstallation: 'dependency-check',
                        additionalArguments: "--scan . --out ${REPORT_DIR} --format HTML --format XML --prettyPrint --nvdApiKey ${NVD_API_KEY}"
                    )
                }
            }
            post {
                always {
                    // Shows findings and trend graph on the job page
                    dependencyCheckPublisher pattern: "${REPORT_DIR}/dependency-check-report.xml"
                }
            }
        }

        stage('SCA: Trivy filesystem scan') {
            steps {
                // Full report: vulnerable npm packages, hardcoded secrets, Dockerfile misconfigurations
                sh '''
                    docker run --rm \
                      -v "$WORKSPACE":/src:ro \
                      -v trivy-cache:/root/.cache/ \
                      "$TRIVY_IMAGE" fs --scanners vuln,secret,misconfig --format table /src \
                      > "$REPORT_DIR/trivy-fs-report.txt"
                '''
                // Quality gate: CRITICAL findings mark the build UNSTABLE
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    sh '''
                        docker run --rm \
                          -v "$WORKSPACE":/src:ro \
                          -v trivy-cache:/root/.cache/ \
                          "$TRIVY_IMAGE" fs --scanners vuln,secret --severity CRITICAL --exit-code 1 /src
                    '''
                }
            }
        }

        // ---------------- BUILD PHASE ----------------

        stage('Build Docker image') {
            steps {
                sh '''
                    docker build --pull --rm -f Dockerfile \
                      -t "$IMAGE_NAME:$IMAGE_TAG" -t "$IMAGE_NAME:latest" .
                '''
            }
        }

        stage('Container scan: Trivy image') {
            steps {
                // Scans the base image OS packages and the npm packages inside the built image
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v trivy-cache:/root/.cache/ \
                      "$TRIVY_IMAGE" image --format table "$IMAGE_NAME:$IMAGE_TAG" \
                      > "$REPORT_DIR/trivy-image-report.txt"
                '''
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    sh '''
                        docker run --rm \
                          -v /var/run/docker.sock:/var/run/docker.sock \
                          -v trivy-cache:/root/.cache/ \
                          "$TRIVY_IMAGE" image --severity CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE_NAME:$IMAGE_TAG"
                    '''
                }
            }
        }

        // ---------------- TEST PHASE ----------------

        stage('Start test instance') {
            steps {
                sh '''
                    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
                    docker run -d --name "$TEST_CONTAINER" \
                      -p "$TEST_PORT:$APP_PORT" \
                      "$IMAGE_NAME:$IMAGE_TAG"

                    # Wait until the application answers
                    for i in $(seq 1 30); do
                      if curl -s -o /dev/null "http://localhost:$TEST_PORT"; then
                        echo "Test instance is up"
                        exit 0
                      fi
                      sleep 2
                    done
                    echo "Test instance did not start"
                    docker logs "$TEST_CONTAINER"
                    exit 1
                '''
            }
        }

        stage('DAST: Nikto') {
            steps {
                catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE') {
                    sh '''
                        docker run --rm --network host \
                          -v "$WORKSPACE/$REPORT_DIR":/tmp \
                          "$NIKTO_IMAGE" \
                          -h "http://localhost:$TEST_PORT" \
                          -o /tmp/nikto-report.html -Format htm \
                          -ask no -maxtime 10m
                    '''
                }
            }
        }

        // ---------------- DEPLOY PHASE ----------------

        stage('Deploy') {
            steps {
                // Course environment: deploys even when findings made the build UNSTABLE.
                // In production, deployment would be blocked by the security gates.
                sh '''
                    docker rm -f "$TEST_CONTAINER" 2>/dev/null || true
                    docker stop "$PROD_CONTAINER" || true
                    docker rm "$PROD_CONTAINER" || true
                    docker run -d -p "$PROD_PORT:$APP_PORT" --name "$PROD_CONTAINER" "$IMAGE_NAME:latest"
                '''
            }
        }
    }

    post {
        always {
            // Tear down the test instance and keep all reports with the build
            sh 'docker rm -f "$TEST_CONTAINER" 2>/dev/null || true'
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
    }
}
